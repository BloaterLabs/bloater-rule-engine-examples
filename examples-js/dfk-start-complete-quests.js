const { ethers } = require("ethers");
const {
  QuestCore,
  HeroCore,
  WalletHelper,
  DFKChainAddresses,
  Profession,
  ContractProvider,
} = require("bloater-rule-engine");

// the config file you want to use. You will need to update this for at least your address.
const config = require("./../config.json");

// The minimum value of a heroes stat where they would go on training quest. This takes into account statboosts.
const minimumStatValueForTrainingQuests = 25;

// The minimum amount of stamina to quest.
const minimumStaminaToQuest = 25;

// The amount of heroes required before you start mining locked tokens. This takes priority over mining gold.
const heroesRequiredToMineLocked = 3;

// The amount of heroes required before you start mining gold.
const heroesRequiredToMineGold = 6;

const provider = new ethers.providers.JsonRpcProvider(config.wallet.rpc);
const walletHelper = new WalletHelper();

// This will get or create a wallet depending on if this is first time running. The wallet helper will use ethers library
// to encrypt, decrypt private key. The private key and a password will be used to create an encrypted wallet so that on
// future runs you will only input the password. The wallet is necessary for any methods that require signing a transaction.
// This method has an optional parameter to pass the password through code if you don't want to manually enter everytime you
// start this. Just be aware of risks that having a password somewhere brings.
walletHelper
  .getOrCreateWallet(config.wallet.walletPath, provider)
  .then(async (wallet) => {
    const dfkAddresses = new DFKChainAddresses();
    const questAddresses = dfkAddresses.questAddresses;
    const contractProvider = new ContractProvider(dfkAddresses.contractAddresses, provider);
    const heroCore = new HeroCore(dfkAddresses, contractProvider.getHeroCoreContract());
    const questCore = new QuestCore(dfkAddresses, contractProvider.getQuestCoreContract(), wallet);

    // Get all the active quests.
    const activeQuests = await questCore.getActiveQuests(wallet.address);

    // Complete any open quests.
    questingStats = {};
    for (const activeQuest of activeQuests) {
      if (activeQuest.isCompletable) {
        console.log(
          `completing ${activeQuest.name} quest for ${activeQuest.heroes} on ${activeQuest.completeAt.toLocaleString()}`
        );
        await questCore.completeQuest(activeQuest.heroes[0], wallet);

        continue;
      }

      questingStats[activeQuest.name] = (questingStats[activeQuest.name] ? questingStats[activeQuest.name] : 0) + 1;
    }

    console.log("Active Quest Counts", questingStats);

    // Get Heroes.
    const heroes = await heroCore.getHeroes(wallet.address);

    const questBuckets = {};
    const questingHeroes = [];

    // Loop through heroes that have current stamina greater then minimum stamina to quest we set above
    for (const hero of heroes.filter((h) => h.currentStamina >= minimumStaminaToQuest)) {
      // If the quest address is not none then that means they are currently questing and we don't need to start quests for them.
      if (hero.questAddress !== questAddresses.none) {
        // put them in their own bucket so we can log them later
        questingHeroes.push(hero.id);
        continue;
      }

      // Check if we want do any training quests
      if (hero.bestTrainingStatValue >= minimumStatValueForTrainingQuests) {
        if (questBuckets[hero.bestTrainingStat] == null) {
          questBuckets[hero.bestTrainingStat] = [];
        }

        questBuckets[hero.bestTrainingStat].push(hero.id);
        continue;
      }

      // Put the remainder in their default profession quests
      // Get profession name from Profession.
      const profession = Object.entries(Profession).find((p) => p[1] === hero.profession)[0];

      // if we haven't created a bucket for this profession do it now.
      if (questBuckets[profession] == null) {
        questBuckets[profession] = [];
      }

      questBuckets[profession].push(hero.id);
    }

    // Start quests where there are heroes. I separated so that we could group up multiple heroes in one run if needed.
    for (const quest in questBuckets) {
      let questLevel = 1; // 0 for profession, 1 for training.
      let heroesToQuest = questBuckets[quest].slice(0, 6);
      let questAddress = questAddresses[quest];
      let questAttempts = Math.floor(minimumStaminaToQuest / 5);

      console.log(`${heroesToQuest.length} heroes ready for ${quest} quest`);
      switch (quest) {
        case "mining":
          if (!questingStats["miningLocked"] && heroesToQuest.length >= heroesRequiredToMineLocked) {
            heroesToQuest = heroesToQuest.slice(0, heroesRequiredToMineLocked);
            questAddress = questAddresses.miningLocked;
          } else if (!questingStats["miningGold"] && heroesToQuest.length >= heroesRequiredToMineGold) {
            heroesToQuest = heroesToQuest.slice(0, heroesRequiredToMineGold);
            questAddress = questAddresses.miningGold;
          } else {
            // don't want to do any mining for now. Let's continue
            continue;
          }
          questLevel = 0;
          questAttempts = 1;
          break;

        case "gardening":
          // Note: This is running gardens in my order preference. Depending on if you have anything in the LPs you might want
          // to adjust this order and add/remove addresses.
          if (heroesToQuest.length < 2) {
            continue;
          }

          questLevel = 0;
          questAttempts = 1;
          heroesToQuest = heroesToQuest.slice(0, 2);
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
      await questCore.startQuest(heroesToQuest, questAddress, questAttempts, questLevel);
    }

    console.log(`${questingHeroes.length} currently questing heroes`);
  })
  .catch((ex) => {
    console.log(ex);
  });
