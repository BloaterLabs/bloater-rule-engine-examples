import { ethers } from "ethers";
import {
  QuestCore,
  HeroCore,
  WalletHelper,
  DFKChainAddresses,
  Profession,
  ContractProvider,
} from "bloater-rule-engine";

import chalk from "chalk";

// the config file you want to use. You will need to update this for at least your address.
import config from "./../config.json" assert { type: "json" };

// The minimum value of a heroes stat where they would go on training quest. This takes into account statboosts.
const minimumStatValueForTrainingQuests = 25;

// HeroIds to force to send to profession quests. I'm using this to keep some of my gardeners doing garden things.
const heroIdsForProfessionQuests = [];

// HereoIds to force to send to training quests. If you want to send some specific heroes that are below the mininum stat value set above.
const heroIdsForTrainingQuests = [];

// The minimum amount of stamina to quest.
const minStaminaToQuest = 25;

// The amount of heroes required before you start mining locked tokens. This takes priority over mining gold.
const heroesRequiredToMineLocked = 2;

// The amount of heroes required before you start mining gold.
const heroesRequiredToMineGold = 2;

const provider = new ethers.providers.JsonRpcProvider(config.wallet.rpc, config.wallet.chainId);
const walletHelper = new WalletHelper();

const dfkAddresses = new DFKChainAddresses();
const questAddresses = dfkAddresses.questAddresses;
const contractProvider = new ContractProvider(dfkAddresses.contractAddresses, provider);
const heroCore = new HeroCore(dfkAddresses, contractProvider.getHeroCoreContract());
const questCore = new QuestCore(dfkAddresses, contractProvider.getQuestCoreContract());

function logFriendlyQuest(quest) {
  console.log(
    `Quest: ${
      quest.name
    }, start date: ${quest.startAt.toLocaleString()}, end date: ${quest.completeAt.toLocaleString()}, heroes: ${quest.heroes.join(
      ", "
    )}`
  );

  if (quest.rewards) {
    quest.rewards.forEach((reward) => {
      const itemsDescription = reward.items
        .map((i) => {
          if (i.item.color) {
            return `${chalk[i.item.color](i.item.name)}: ${ethers.utils.formatUnits(i.amount, i.item.decimals)}`;
          }
          return `${i.item.name}: ${ethers.utils.formatUnits(i.amount, i.item.decimals)}`;
        })
        .join(", ");

      const rewardXp = reward.xp > 200 ? chalk.bold(`${reward.xp}`) : reward.xp;

      const skillupFormatted = reward.skillUp > 0 ? `, skillup: ${reward.skillUp / 10}` : "";

      console.log(`* heroId: ${reward.heroId}, xp: ${rewardXp}${skillupFormatted}, items: ${itemsDescription}`);
    });
  }
}

// This will get or create a wallet depending on if this is first time running. The wallet helper will use ethers library
// to encrypt, decrypt private key. The private key and a password will be used to create an encrypted wallet so that on
// future runs you will only input the password. The wallet is necessary for any methods that require signing a transaction.
// This method has an optional parameter to pass the password through code if you don't want to manually enter everytime you
// start this. Just be aware of risks that having a password somewhere brings.
walletHelper
  .getOrCreateWallet(config.wallet.walletPath, provider)
  .then(async (wallet) => {
    // Get all the active quests.
    const activeQuests = await questCore.getActiveQuests(wallet.address);

    // Complete any open quests.
    const questingStats = {};
    for (const activeQuest of activeQuests) {
      if (activeQuest.isCompletable) {
        console.log(
          `completing ${activeQuest.name} quest for ${activeQuest.heroes} on ${activeQuest.completeAt.toLocaleString()}`
        );

        const questResult = await questCore.completeQuest(activeQuest.heroes[0], wallet);

        // if complete quest fails then this will be null
        if (questResult) {
          logFriendlyQuest(questResult);
        }

        continue;
      }

      questingStats[activeQuest.name] =
        (questingStats[activeQuest.name] ? questingStats[activeQuest.name] : 0) + activeQuest.heroes.length;
    }

    console.log("Active Quest Counts", questingStats);

    // Get Heroes.
    const heroes = await heroCore.getHeroes(wallet.address);

    const questBuckets = {};
    const questingHeroes = [];

    // Loop through heroes that have current stamina greater then minimum stamina to quest we set above
    for (const hero of heroes.filter((h) => h.currentStamina >= minStaminaToQuest)) {
      // If the quest address is not none then that means they are currently questing and we don't need to start quests for them.
      if (hero.questAddress !== questAddresses.none) {
        // put them in their own bucket so we can log them later
        questingHeroes.push(hero.id); // todo remove once we validate numbers.
        continue;
      }

      // Get profession name from Profession.
      const profession = Object.entries(Profession).find((p) => p[1] === hero.profession)[0];

      // Check if we want do any training quests
      if (
        !heroIdsForProfessionQuests.includes(hero.id) &&
        (hero.bestTrainingStatValue >= minimumStatValueForTrainingQuests || heroIdsForTrainingQuests.includes(hero.id))
      ) {
        if (questBuckets[hero.bestTrainingStat] == null) {
          questBuckets[hero.bestTrainingStat] = [];
        }

        questBuckets[hero.bestTrainingStat].push(hero);
        continue;
      }

      // Put the remainder in their default profession quests
      // if we haven't created a bucket for this profession do it now.
      if (questBuckets[profession] == null) {
        questBuckets[profession] = [];
      }

      questBuckets[profession].push(hero);
    }

    // Start quests where there are heroes. I separated so that we could group up multiple heroes in one run if needed.
    for (const quest in questBuckets) {
      let questLevel = 1; // 0 for profession, 1 for training.
      let heroesToQuest = questBuckets[quest].slice(0, 6);
      let questAddress = questAddresses[quest];
      let questAttempts = Math.floor(minStaminaToQuest / 5);

      console.log(`${heroesToQuest.length} heroes ready for ${quest} quest`);
      switch (quest) {
        case "mining":
          if (!questingStats["miningLocked"] && heroesToQuest.length >= heroesRequiredToMineLocked) {
            heroesToQuest = heroesToQuest.slice(0, heroesRequiredToMineLocked);
            questAddress = questAddresses.miningLocked;
          } else if (!questingStats["miningGold"] && heroesToQuest.length >= heroesRequiredToMineGold) {
            questAddress = questAddresses.miningGold;
          } else {
            // don't want to do any mining for now. Let's continue
            continue;
          }
          questLevel = 0;
          questAttempts = Math.min(...heroesToQuest.map((h) => h.currentStamina));
          break;

        case "gardening":
          // Note: This is running gardens in my order preference. Depending on if you have anything in the LPs you might want
          // to adjust this order and add/remove addresses.
          if (heroesToQuest.length < 2) {
            continue;
          }

          questLevel = 0;
          heroesToQuest = heroesToQuest.slice(0, 2);
          questAttempts = Math.min(...heroesToQuest.map((h) => h.currentStamina));

          if (!questingStats["gardeningCrystalEth"]) {
            questAddress = questAddresses.gardeningCrystalEth;
          } else if (!questingStats["gardeningJewelBtc"]) {
            questAddress = questAddresses.gardeningJewelBtc;
          } else {
            // don't do any gardening for now.
            continue;
          }
          break;

        case "foraging":
        case "fishing":
          questLevel = 0;
          break;
      }

      // Start the quest.
      await questCore.startQuest(
        heroesToQuest.map((h) => h.id),
        questAddress,
        questAttempts,
        questLevel,
        wallet
      );
    }

    console.log(`${questingHeroes.length} currently questing heroes (I don't think this includes new quests)`);
  })
  .catch((ex) => {
    console.log(ex);
  });
