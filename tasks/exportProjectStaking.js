const { task, types } = require('hardhat/config');
const { writeCsvFile, formatEther } = require('../common/utils');
const {
  CONSOLE_LOG_RED_COLOR,
  CONSOLE_LOG_GREEN_COLOR,
  LOCAL_NETWORK_URL
} = require('../common/constants');

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

task('export:project:staking', 'Crawling information of project staking')
  .addParam('projectId', 'Id of target project', 0, types.int)
  .addParam('contractAddress', 'Address of Project contract')
  .addOptionalParam('networkUrl', 'RPC provider URL of target network', LOCAL_NETWORK_URL)
  .setAction(async (taskArgs) => {
    try {
      let ProjectArtifact;
      try {
        ProjectArtifact = require('../artifacts/contracts/Project.sol/Project.json');
      } catch (error) {
        console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Please compile contracts by running below command before using this scripts!!!`);
        console.log(CONSOLE_LOG_RED_COLOR, `   ---> npx hardhat compile`);
        return;
      }

      const provider = new ethers.providers.JsonRpcProvider(taskArgs.networkUrl);
      const projectContract = new ethers.Contract(taskArgs.contractAddress, ProjectArtifact.abi, provider);

      const stakeInfo = await projectContract.getStakeInfo(taskArgs.projectId);
      if (stakeInfo.startBlockNumber.isZero() || stakeInfo.endBlockNumber.isZero()) {
        console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Project id is not valid`);
        return;
      }

      const startBlock = stakeInfo.startBlockNumber.toNumber();
      const endBlock = stakeInfo.endBlockNumber.toNumber();

      let queryStartBlock = startBlock;
      const stakedNFTAccounts = [];
      const stakedGMIAccounts = [];

      while (queryStartBlock < endBlock) {
        console.log(`Crawling data from block ${queryStartBlock} -> ${queryStartBlock + 5000}`)
        const events = await projectContract.queryFilter(
          [],
          queryStartBlock,
          queryStartBlock + 5000
        )

        for (let i = 0; i < events.length; i++) {
          const data = events[i].args;
          if (events[i].event === 'StakeWithMemberCard' && data.projectId.toNumber() === taskArgs.projectId) {
            stakedNFTAccounts.push({
              account: data.account,
              amount: formatEther(data.portion)
            })
          } else if (events[i].event === 'Stake' && data.projectId.toNumber() === taskArgs.projectId) {
            stakedGMIAccounts.push({
              account: data.account,
              amount: formatEther(data.amount)
            })
          }
        }

        queryStartBlock += 5000;
        await sleep(5000)
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
      let fileName = `./stakedNFTAccounts_${Date.now()}.csv`;
      await writeCsvFile(fileName, stakedNFTAccounts);
      console.log(CONSOLE_LOG_GREEN_COLOR, `\n==> Exported csv file: ${fileName}\n`);

      fileName = `./stakedGMIAccounts_${Date.now()}.csv`;
      await writeCsvFile(fileName, stakedGMIAccounts);
      console.log(CONSOLE_LOG_GREEN_COLOR, `\n==> Exported csv file: ${fileName}\n`);
    } catch (error) {
      console.log(CONSOLE_LOG_RED_COLOR, 'Export failed!')
      console.log(error);
    }
  });
