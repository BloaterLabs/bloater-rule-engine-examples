const { QuestCore, DFKChainAddresses, ContractProvider } = require("bloater-rule-engine");

// This example is not doing any signing so no private key is needed. We only use the rpc and wallet address from config.
const config = require("./../config.json");
const { ethers } = require("ethers");

questStatus = {
  1: "Start",
  2: "Complete",
};

function logFriendlyQuest(quest) {
  const status = questStatus[quest.status];
  const questStart = quest.startAt.toLocaleString();
  const questComplete = quest.completeAt.toLocaleString();
  const heroIds = quest.heroes.join(", ");

  console.log(
    `Quest: ${status} ${quest.name}, start date: ${questStart}, end date: ${questComplete}, heroes: ${heroIds}, attempts: ${quest.attempts}`
  );

  if (quest.rewards) {
    quest.rewards.forEach((reward) => {
      const itemsDescription = reward.items
        .map((i) => `${i.item.name}: ${ethers.utils.formatUnits(i.amount, i.item.decimals)}`)
        .join(", ");

      console.log(
        `* heroId: ${reward.heroId}, xp: ${reward.xp}, skillup: ${reward.skillUp / 10}, items: ${itemsDescription}`
      );
    });
  }
}

const provider = new ethers.providers.JsonRpcProvider(config.wallet.rpc);
const dfkAddresses = new DFKChainAddresses();
const contractProvider = new ContractProvider(dfkAddresses.contractAddresses, provider);

const questCore = new QuestCore(dfkAddresses, contractProvider.getQuestCoreContract());

// number of blocks we want to get history for. Seems like max for public rpcs is 2048.
const blockHistory = -2000;

// get completed quests events that happened in the last 2000 blocks. This is to show some history when first starting script.
questCore.getQuestCompletedEvents(config.wallet.address, blockHistory).then(
  (questsCompleted) => {
    for (const quest of questsCompleted) {
      logFriendlyQuest(quest);
    }
  },
  (error) => {
    console.log("error trying to get historical quest completed events", error);
  }
);

// watch the questStarted event for the given address.
questCore.onQuestStarted(config.wallet.address, (quest) => {
  logFriendlyQuest(quest);
});

// watch the questCompleted event for the given address.
questCore.onQuestCompleted(config.wallet.address, (quest) => {
  logFriendlyQuest(quest);
});
