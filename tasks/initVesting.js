const { task } = require('hardhat/config');
const { NonceManager } = require("@ethersproject/experimental");
const { add } = require('js-big-decimal');
const { readCsvFile } = require('../common/utils');

const CONSOLE_LOG_RED_COLOR = "\x1b[31m"
const CONSOLE_LOG_GREEN_COLOR = "\x1b[32m"
const LOCAL_NETWORK_URL = 'http://127.0.0.1:8545';

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


task('init:vesting', 'Init vesting for Launch Pool investors')
  .addParam('csv', 'The CSV file path that contain a list of addresses and amount of token.')
  .addOptionalParam('networkUrl', 'RPC provider URL of target network', LOCAL_NETWORK_URL)
  .addOptionalParam('contract', 'Address of Vesting contract')
  .addOptionalParam('gasRate', 'Rate of gas price that need to mul with current gas price', 1, types.float)
  .setAction(async (taskArgs) => {
    try {
      // Loading contents from CSV file
      const records = await readCsvFile(taskArgs.csv);
      const csvContents = records.map(record => {
        return {
          address: record[0],
          amount: record[1]
        }
      });

      const sendAmounts = csvContents.map(row => row.amount);
      let totalAmount = '0';
      for (let i = 0; i < sendAmounts.length; i++) {
        totalAmount = add(totalAmount, sendAmounts[i]);
      }
      console.log('AAAAAAAAAAAAAAAA', totalAmount);

      const sendInitials = csvContents.map(row => '0');

      // Validate duplicated addresses
      const sendAddresses = csvContents.map(row => row.address);
      const duplicatedAddrs = sendAddresses.getDuplicates();
      if (duplicatedAddrs.length > 0) {
        console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Below records have duplicated addresses, please check again`);
        console.table(duplicatedAddrs);
        return;
      }

      // Validate invalid addresses
      const invalidAddrs = sendAddresses.filter(addr => !ethers.utils.isAddress(addr));
      if (invalidAddrs.length > 0) {
        console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Below records have invalid address, please check again`);
        console.table(invalidAddrs);
        return;
      }

      // Validate send amount
      const invalidAmounts = csvContents.filter(row => {
        return !row.amount || Number(row.amount) <= 0;
      });
      if (invalidAmounts.length > 0) {
        console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Below records has invalid amount to send, please check again`);
        console.table(invalidAmounts);
        return;
      }

      // Validate token address
      if (taskArgs.contract) {
        if (!ethers.utils.isAddress(taskArgs.contract)) {
          console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Param --token address are invalid, please check again`);
          console.table([taskArgs.contract]);
          return;
        }
      }

      // Validate MULTISEND_ADMIN_ACCOUNT address who send BNB and token
      if (!process.env.MULTISEND_ADMIN_ACCOUNT) {
        console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Please fill MULTISEND_ADMIN_ACCOUNT private key that will send BNBs and tokens in .env file`);
        return;
      }

      const provider = new ethers.providers.JsonRpcProvider(taskArgs.networkUrl);
      const signer = new ethers.Wallet(process.env.MULTISEND_ADMIN_ACCOUNT, provider);
      const admin = new NonceManager(signer);

      const gasPrice = await provider.getGasPrice();
      console.log('AAAAAAAAAAAAAA', gasPrice.toString())

      let artifact;
      try {
        artifact = require('../artifacts/contracts/VestingLaunchPool.sol/VestingLaunchPool.json');
      } catch (error) {
        console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Please compile contracts by running below command before using this scripts!!!`);
        console.log(CONSOLE_LOG_RED_COLOR, `   ---> npx hardhat compile`);
        return;
      }

      const contract = new ethers.Contract(taskArgs.contract, artifact.abi, admin);
      const gasLimit = await contract.estimateGas.initiateVests(
        sendAddresses,
        sendAmounts,
        sendInitials,
        0,
        totalAmount,
        0,
        '23328000'
      );

      const transaction = await contract.initiateVests(
        sendAddresses,
        sendAmounts,
        sendInitials,
        0,
        totalAmount,
        0,
        '23328000',
        { gasPrice, gasLimit }
      );

      await transaction.wait();

      console.log(CONSOLE_LOG_GREEN_COLOR, `\nSending successfully!!!`);
    } catch (error) {
      console.log(CONSOLE_LOG_RED_COLOR, `\nMulti send failed!`)
      console.log(error);
    }
  });
