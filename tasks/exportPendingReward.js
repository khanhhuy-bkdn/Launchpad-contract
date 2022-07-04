const { task, types } = require('hardhat/config');
const { Contract, Provider } = require('ethers-multicall');
const { formatEther, readCsvFile, writeCsvFile } = require('../common/utils');
const {
  CONSOLE_LOG_RED_COLOR,
  CONSOLE_LOG_GREEN_COLOR,
  LOCAL_NETWORK_URL
} = require('../common/constants');

Array.prototype.contains = function(v) {
  for (var i = 0; i < this.length; i++) {
    if (this[i] === v) return true;
  }
  return false;
};

Array.prototype.getDuplicates = function() {
  var arr = [];
  var uniqueArr = []
  for (var i = 0; i < this.length; i++) {
    if (!uniqueArr.contains(this[i])) {
      uniqueArr.push(this[i]);
    } else {
      arr.push(this[i]);
    }
  }
  return arr;
}

task('export:pendingreward', 'Crawling information of whitelisted users')
  .addParam('whitelistCsv', 'The CSV file that contain a list of addresses')
  .addParam('contractAddress', 'Address of Project contract')
  .addOptionalParam('networkUrl', 'RPC provider URL of target network', LOCAL_NETWORK_URL)
  .setAction(async (taskArgs) => {
    try {
      // Loading addresses from CSV file
      const records = await readCsvFile(taskArgs.whitelistCsv);
      const targetAddrs = records.map(record => record[0]);

      // Check duplicated addresses
      const duplicatedAddrs = targetAddrs.getDuplicates();
      if (duplicatedAddrs.length > 0) {
        console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Below addresses are duplicated addresses in your address file, please check again`);
        for (let i = 0; i < duplicatedAddrs.length; i++) {
          console.log(` ${i + 1}. ${duplicatedAddrs[i]}`)
        }
        return;
      }

      // Check invalid addresses
      const invalidAddrs = targetAddrs.filter(item => !ethers.utils.isAddress(item));
      if (invalidAddrs.length > 0) {
        console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Below addresses are invalid address, please check again in your address file`);
        for (let i = 0; i < invalidAddrs.length; i++) {
          console.log(` ${i + 1}. ${invalidAddrs[i]}`)
        }
        return;
      }

      // Check invalid project contract addresses
      if (!taskArgs.contractAddress || !ethers.utils.isAddress(taskArgs.contractAddress)) {
        console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Below Project address are invalid, please check your contract-address param again`);
        return;
      }

      // Init providers
      const provider = new ethers.providers.JsonRpcProvider(taskArgs.networkUrl);
      const multiCallProvider = new Provider(provider);
      await multiCallProvider.init();

      let ProjectArtifact;
      try {
        ProjectArtifact = require('../artifacts/contracts/Staking60d.sol/Staking60d.json');
      } catch (error) {
        console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Please compile contracts by running below command before using this scripts!!!`);
        console.log(CONSOLE_LOG_RED_COLOR, `   ---> npx hardhat compile`);
        return;
      }

      const projectContract = new Contract(taskArgs.contractAddress, ProjectArtifact.abi);

      // Get user informations
      const calls = targetAddrs.map(addr => projectContract.pendingRewards(addr));
      const res = (await multiCallProvider.all(calls, {}))

      const summary = [];
      for (let i = 0; i < targetAddrs.length; i++) {
        const item = res[i];

        summary.push({
          'Address': targetAddrs[i],
          'Reward': formatEther(item)
        });
      }

      const currentDate = new Date();
      var formatedDate = "Last checking: " + currentDate.getDate() + "/"
                + (currentDate.getUTCMonth()+1)  + "/"
                + currentDate.getUTCFullYear() + " "
                + currentDate.getUTCHours() + ":"
                + currentDate.getUTCMinutes() + ":"
                + currentDate.getUTCSeconds();
      console.log(`\n${formatedDate} UTC\n`);

      // Export results to csv
      const fileName = `Staking_pending_reward_${Date.now()}.csv`;
      await writeCsvFile(fileName, summary)
      console.log(CONSOLE_LOG_GREEN_COLOR, `\n==> Exported csv file: ${fileName}\n`);
    } catch (error) {
      console.log(CONSOLE_LOG_RED_COLOR, 'Export funded list failed!')
      console.log(error);
    }
  });
