const { ethers } = require("ethers");
const { QuestCore, HeroCore, WalletHelper, DFKChainAddresses, Profession } = require("bloater-rule-engine");

// the config file you want to use. You will need to update this for at least your address.
const config = require("./../config.json");

const provider = new ethers.providers.JsonRpcProvider(config.wallet.rpc);
const walletHelper = new WalletHelper();

// This will get or create a wallet depending on if this is first time running. The wallet helper will use ethers library 
// to encrypt, decrypt private key. The private key and a password will be used to create an encrypted wallet so that on 
// future runs you will only input the password. The wallet is necessary for any methods that require signing a transaction.
// This method has an optional parameter to pass the password through code if you don't want to manually enter everytime you 
// start this. Just be aware of risks that having a password somewhere brings.
walletHelper.getOrCreateWallet(config.wallet.walletPath, provider).then(async wallet =>  {
    const dfkAddresses = new DFKChainAddresses();
    const heroCore = new HeroCore(dfkAddresses, provider);
    const questCore = new QuestCore(dfkAddresses, provider, wallet);

    // Get all the active quests.
    const activeQuests = await questCore.getActiveQuests(wallet.address);

    // Complete any open quests.
    questingStats = {};
    for (const activeQuest of activeQuests) {
        if (activeQuest.isComplete) {
            console.log(`completing ${activeQuest.name} quest for ${activeQuest.heroes} on ${activeQuest.completeAt}`);
            await questCore.completeQuest(activeQuest.heroes[0], wallet);

            continue;
        }

        questingStats[activeQuest.name] = ((questingStats[activeQuest.name]) ? questingStats[activeQuest.name]: 0) + 1;
    }

    console.log('Active Quest Counts', questingStats);

    // Get Heroes.
    const heroes = await heroCore.getHeroes(wallet.address);
    const fishingHeroes = [];
    const foragingHeroes = [];
    const gardeningHeroes = [];
    const miningHeroes = [];
    const questingHeroes = [];
    
    // Loop through heroes that have 25 or more stamina
    for (const hero of heroes.filter(h => h.currentStamina >= 25)) {
        // If the quest address is not none then that means they are currently questing and we don't need to start quests for them.
        if (hero.questAddress !== dfkAddresses.questAddresses.none) {
            // put them in their own bucket so we can log them later
            questingHeroes.push(hero.id);
            continue;
        }

        // This script currently only deals with basic professions so put heroes in buckets for profession quests.
        switch (hero.profession) {
            case Profession.Fishing:
                fishingHeroes.push(hero.id);
                break;

            case Profession.Foraging:
                foragingHeroes.push(hero.id);
                break;

            case Profession.Gardening:
                gardeningHeroes.push(hero.id);
                break;

            case Profession.Mining:
                miningHeroes.push(hero.id);
                break;
            
            default:
                console.log(`unknown profession HeroId: ${hero.id} profession: ${hero.profession}`);
                break;
        }
    }

    // Now start any profession quests where there are heroes. I separated so that we could group up 
    // multiple heroes in one run if needed.

    // todo: only starting one quest per group with each run. Change so it queues them up together in single run.
    if (fishingHeroes.length > 0) {
        console.log(`${fishingHeroes.length} heroes ready to fish`);
        await questCore.startQuest(fishingHeroes.slice(0, 6), dfkAddresses.questAddresses.fishing);
    }

    if (foragingHeroes.length > 0) {
        console.log(`${foragingHeroes.length} heroes ready to forage`);
        await questCore.startQuest(foragingHeroes.slice(0, 6), dfkAddresses.questAddresses.foraging);
    }

    if (miningHeroes.length > 0) {
        console.log(`${miningHeroes.length} heroes ready to mine`);
     
        // Note: This is grouping up mining heroes so that it will only queue up 3 for the Crystal mine or 6 for gold. 
        // You will likely want to adjust this for your circumstances. 
        if (miningHeroes.length >= 3) {
            if (!questingStats["miningLocked"]) {
                await questCore.startQuest(miningHeroes.slice(0, 3), dfkAddresses.questAddresses.miningLocked, 1);
            } else if (!questingStats["miningGold"] && miningHeroes.length >= 6) {
                await questCore.startQuest(miningHeroes.slice(0, 6), dfkAddresses.questAddresses.miningGold, 1);
            }
        }
    }

    if (gardeningHeroes.length > 0) {
        console.log(`${gardeningHeroes.length} heroes ready to garden`);

        // Note: This is running gardens in my order preference. Depending on if you have anything in the LPs you might want
        // to adjust this order and add/remove addresses.
        if (gardeningHeroes.length >= 2) {
            if (!questingStats["gardeningCrystalEth"]) {
                await questCore.startQuest(gardeningHeroes.slice(0, 2), dfkAddresses.questAddresses.gardeningCrystalEth, 1);
            } else if (!questingStats["gardeningJewelBtc"]) {
                await questCore.startQuest(gardeningHeroes.slice(0, 2), dfkAddresses.questAddresses.gardeningJewelBtc, 1);
            } else if (!questingStats["gardeningCrystalAvax"]) {
                await questCore.startQuest(gardeningHeroes.slice(0, 2), dfkAddresses.questAddresses.gardeningCrystalAvax, 1);
            } else if (!questingStats["gardeningCrystalJewel"]) {
                await questCore.startQuest(gardeningHeroes.slice(0, 2), dfkAddresses.questAddresses.gardeningCrystalJewel, 1);
            } else if (!questingStats["gardeningCrystalUsdc"]) {
                await questCore.startQuest(gardeningHeroes.slice(0, 2), dfkAddresses.questAddresses.gardeningCrystalUsdc, 1);
            }
        }
    }

    console.log(`${questingHeroes.length} currently questing heroes`);
}).catch(ex => {
    console.log(ex);
});