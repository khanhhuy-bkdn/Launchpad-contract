const { task } = require('hardhat/config');
const { Contract, Provider } = require('ethers-multicall');
const ObjectsToCsv = require('objects-to-csv');
const { formatEther, readCsvFile, formatUnits } = require('../common/utils');

const CONSOLE_LOG_RED_COLOR = "\x1b[31m";
const CONSOLE_LOG_GREEN_COLOR = "\x1b[32m";
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

task('checkBalances', 'Check BNB balances and all ERC20 token balances of given account list')
  .addParam('addressCsv', 'The CSV file that contain a list of addresses.')
  .addOptionalParam('tokens', 'List of ERC20 token address (CASH, 420, s420)', '')
  .addOptionalParam('networkUrl', 'RPC provider URL of target network', LOCAL_NETWORK_URL)
  .setAction(async (taskArgs) => {
    try {
      // Loading addresses from CSV file
      const records = await readCsvFile(taskArgs.addressCsv);
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

      // Check invalid token contract addresses
      let tokenAddrs = [];
      if (taskArgs.tokens && taskArgs.tokens !== '') {
        tokenAddrs = taskArgs.tokens.split(',');
        const invalidTokenAddrs = tokenAddrs.filter(item => !ethers.utils.isAddress(item));
        if (invalidTokenAddrs.length > 0) {
          console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Below token addresses are invalid, please check your tokens param again`);
          for (let i = 0; i < invalidTokenAddrs.length; i++) {
            console.log(` ${i + 1}. ${invalidTokenAddrs[i]}`)
          }
          return;
        }
      }

      // Init providers
      const provider = new ethers.providers.JsonRpcProvider(taskArgs.networkUrl);
      const multiCallProvider = new Provider(provider);
      await multiCallProvider.init();

      let ERC20Artifact;
      try {
        ERC20Artifact = require('../artifacts/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol/IERC20Metadata.json');
      } catch (error) {
        console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Please compile contracts by running below command before using this scripts!!!`);
        console.log(CONSOLE_LOG_RED_COLOR, `   ---> npx hardhat compile`);
        return;
      }

      const erc20Contracts = tokenAddrs.map(tokenAddr => {
        return new Contract(tokenAddr, ERC20Artifact.abi);
      });

      // Get token decimals
      const tokenDecimalCalls = erc20Contracts.map(contract => contract.decimals());
      const tokenDecimals = await multiCallProvider.all(tokenDecimalCalls, {});

      // Get token symbols
      const tokenSymbolCalls = erc20Contracts.map(contract => contract.symbol());
      const tokenSymbols = await multiCallProvider.all(tokenSymbolCalls, {});

      // Get BNB balances
      const avaxBalanceCalls = targetAddrs.map(addr => multiCallProvider.getEthBalance(addr));;
      const avaxBalances = await multiCallProvider.all(avaxBalanceCalls, {});

      // Get token balances
      const tokenBalances = [];
      for (let i = 0; i < erc20Contracts.length; i++) {
        const tokenBalancesCall = targetAddrs.map(addr => erc20Contracts[i].balanceOf(addr));
        const balances = await multiCallProvider.all(tokenBalancesCall, {});
        tokenBalances.push(balances);
      }

      // Summary balances and infomations
      const summaryBalances = [];
      for (let i = 0; i < targetAddrs.length; i++) {
        const userBalances = { 'Address': targetAddrs[i] };

        // Get transaction count (nonce)
        const count = await provider.getTransactionCount(targetAddrs[i]);
        userBalances['Transaction Count'] = count;
        userBalances['BNB'] = formatEther(avaxBalances[i]);

        for (let j = 0; j < erc20Contracts.length; j++) {
          const value = formatUnits(tokenBalances[j][i], tokenDecimals[j])
          const symbol = `Token ${tokenSymbols[j]}`;
          userBalances[symbol] = value;
        }

        summaryBalances.push(userBalances);
      }

      const currentDate = new Date();
      var formatedDate = "Last checking: " + currentDate.getDate() + "/"
                + (currentDate.getUTCMonth()+1)  + "/"
                + currentDate.getUTCFullYear() + " "
                + currentDate.getUTCHours() + ":"
                + currentDate.getUTCMinutes() + ":"
                + currentDate.getUTCSeconds();
      console.log(`\n${formatedDate} UTC\n`);
      console.table(summaryBalances);

      // Export results to csv
      const csv = new ObjectsToCsv(summaryBalances);

      const fileName = `ExportedBalances_${Date.now()}.csv`;
      await csv.toDisk(`./${fileName}`);
      console.log(CONSOLE_LOG_GREEN_COLOR, `\n==> Exported csv file: ${fileName}\n`);
    } catch (error) {
      console.log(CONSOLE_LOG_RED_COLOR, 'Check balances failed!')
      console.log(error);
    }
  });
