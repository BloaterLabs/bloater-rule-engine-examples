const { QuestCore, DFKChainAddresses } = require("bloater-rule-engine");

// This example is not doing any signing so no private key is needed. We only use the rpc and wallet address from config.
const config = require("./../config.json");
const { ethers } = require("ethers");

const rpcAddress = config.wallet.rpc;
const provider = new ethers.providers.JsonRpcProvider(rpcAddress);

const dfkAddresses = new DFKChainAddresses();

questStatus = {
    1: 'Start',
    2: 'Complete',
}

function logFriendlyQuest(quest) {
    console.log(`Quest: ${questStatus[quest.status]} ${quest.name}, start date: ${quest.startAt.toLocaleString()}, end date: ${quest.completeAt.toLocaleString()}, heroes: ${quest.heroes.join(', ')}, attempts: ${quest.attempts}`);
    
    if (quest.rewards) {
        quest.rewards.forEach(reward => {
            const itemsDescription = reward.items.map(i => `${i.item.name}: ${ethers.utils.formatUnits(i.amount, i.item.decimals)}`).join(', ');
            console.log(`* heroId: ${reward.heroId}, xp: ${reward.xp}, skillup: ${reward.skillUp / 10}, items: ${itemsDescription}`);
        });
    }
}

const questCore = new QuestCore(dfkAddresses, provider);

// number of blocks we want to get history for. Seems like max for public rpcs is 2048.
const blockHistory = -2000;

// get completed quests events that happened in the last 2000 blocks. This is to show some history when first starting script.
questCore.getQuestCompletedEvents(config.wallet.address, blockHistory)
    .then((questsCompleted) => {
        for (const quest of questsCompleted) {
            logFriendlyQuest(quest);
        }
    }, (error) => {
        console.log('error trying to get historical quest completed events', error);
    });

// watch the questStarted event for the given address.
questCore.onQuestStarted(config.wallet.address, (quest) => {
    logFriendlyQuest(quest);
});

// watch the questCompleted event for the given address.
questCore.onQuestCompleted(config.wallet.address, (quest) => {
    logFriendlyQuest(quest);
});