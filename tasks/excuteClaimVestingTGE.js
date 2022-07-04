const { task, types } = require('hardhat/config');
const { readCsvFile } = require('../common/utils');
const { NonceManager } = require('@ethersproject/experimental');
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

const calGasFee = (receipt) => {
  if (!receipt.gasUsed || receipt.gasUsed.isZero()) return 0;
  if (!receipt.effectiveGasPrice || receipt.effectiveGasPrice.isZero()) return 0;
  return Number(ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice)));
}

const printTable = (record) => {
  if (record.reason === '') {
    console.table([
      ['No.', record.id],
      ['Status', record.status],
      ['Address', record.address],
      ['Transaction Hash', record.txHash],
      ['Block Hash', record.blockHash],
      ['Gas Fee', `${record.gasFee} BNB`],
      ['Start Time', record.startTime],
      ['End Time', record.endTime]
    ]);
  } else {
    console.table([
      ['No.', record.id],
      ['Status', record.status],
      ['Address', record.address],
      ['Start Time', record.startTime],
      ['End Time', record.endTime]
    ]);
    console.log(record.reason);
  }
}

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

const formatedDate = (currentDate) => {
  return currentDate.getDate() + "/"
    + (currentDate.getUTCMonth()+1)  + "/"
    + currentDate.getUTCFullYear() + " "
    + currentDate.getUTCHours() + ":"
    + currentDate.getUTCMinutes() + ":"
    + currentDate.getUTCSeconds();
}

task('excute:vesting:users', 'Claim token of users')
  .addParam('privateKeyCsv', 'The CSV file that contain a list of private key')
  .addParam('contractAddress', 'Address of VestingTGE contract')
  .addOptionalParam('networkUrl', 'RPC provider URL of target network', LOCAL_NETWORK_URL)
  .setAction(async (taskArgs) => {
    try {
      // Loading private key from CSV file
      const records = await readCsvFile(taskArgs.privateKeyCsv);
      const targetAddrs = records.map(record => record[0]);

      // Check duplicated private key
      const duplicatedAddrs = targetAddrs.getDuplicates();
      if (duplicatedAddrs.length > 0) {
        console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Below private key are duplicated private key in your private key file, please check again`);
        for (let i = 0; i < duplicatedAddrs.length; i++) {
          console.log(` ${i + 1}. ${duplicatedAddrs[i]}`)
        }
        return;
      }

      // Check invalid vestingTGE contract addresses
      if (!taskArgs.contractAddress || !ethers.utils.isAddress(taskArgs.contractAddress)) {
        console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Below VestingTGE address are invalid, please check your contract-address param again`);
        return;
      }

      // Init providers
      const provider = new ethers.providers.JsonRpcProvider(taskArgs.networkUrl);
      const providerGasPrice = await provider.getGasPrice();

      let VestingTGEArtifact;
      try {
        VestingTGEArtifact = require('../artifacts/contracts/VestingTGE.sol/VestingTGE.json');
      } catch (error) {
        console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Please compile contracts by running below command before using this scripts!!!`);
        console.log(CONSOLE_LOG_RED_COLOR, `   ---> npx hardhat compile`);
        return;
      }

      for (let i = 0; i < targetAddrs.length; i++) {
        const summary = {
          id: i + 1,
          startTime: formatedDate(new Date())
        }
        const signer = new ethers.Wallet(targetAddrs[i], provider);
        const user = new NonceManager(signer);
        const vestingTGEContract = new ethers.Contract(taskArgs.contractAddress, VestingTGEArtifact.abi, user);

        summary['address'] = user.signer.address;

        const gasLimit = await vestingTGEContract.estimateGas.claim({ gasPrice: providerGasPrice });

        try {
          const transaction = await vestingTGEContract.claim({ gasPrice: providerGasPrice, gasLimit: gasLimit });

          const receipt = await transaction.wait();

          summary['status'] = 'SUCCESS';
          summary['txHash'] = receipt.transactionHash;
          summary['blockHash'] = receipt.blockHash;

          const gasFee = calGasFee(receipt);
          summary['gasFee'] = gasFee;

          summary['reason'] = '';
        } catch (error) {
          summary['status'] = 'FAILED';
          summary['reason'] = error.toString();
          summary['txHash'] = '';
          summary['blockHash'] = '';
          summary['gasFee'] = 0;
        }
        summary['endTime'] = formatedDate(new Date());
        printTable(summary);
      }

      const currentDate = new Date();
      console.log(`\n${formatedDate(currentDate)} UTC\n`);

      console.log(CONSOLE_LOG_GREEN_COLOR, `\n==> Excute claim done\n`);
    } catch (error) {
      console.log(CONSOLE_LOG_RED_COLOR, 'Excute claim vestingTGE failed!')
      console.log(error);
    }
  });
