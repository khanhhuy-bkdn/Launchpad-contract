const { task } = require('hardhat/config');
const { NonceManager } = require("@ethersproject/experimental");
const ObjectsToCsv = require('objects-to-csv');
const { multiply } = require('js-big-decimal');
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

const printTable = (record) => {
  if (record.reason === '') {
    console.table([
      ['No.', record.id],
      ['Status', record.status],
      ['Address', record.address],
      ['Amount', `${Number(record.amount)} ${record.symbol}`],
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
      ['Amount', `${Number(record.amount)} ${record.symbol}`],
      ['Start Time', record.startTime],
      ['End Time', record.endTime]
    ]);
    console.log(record.reason);
  }
}

const formatedDate = (currentDate) => {
  return currentDate.getDate() + "/"
    + (currentDate.getUTCMonth()+1)  + "/"
    + currentDate.getUTCFullYear() + " "
    + currentDate.getUTCHours() + ":"
    + currentDate.getUTCMinutes() + ":"
    + currentDate.getUTCSeconds();
}

const calGasFee = (receipt) => {
  if (!receipt.gasUsed || receipt.gasUsed.isZero()) return 0;
  if (!receipt.effectiveGasPrice || receipt.effectiveGasPrice.isZero()) return 0;
  return Number(ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice)));
}

task('multiSend', 'Send a number of BNB/ERC20 token to target addresses')
  .addParam('multisendCsv', 'The CSV file path that contain a list of addresses and amount of token.')
  .addOptionalParam('networkUrl', 'RPC provider URL of target network', LOCAL_NETWORK_URL)
  .addOptionalParam('token', 'Address of the deployed token contract')
  .addOptionalParam('gasRate', 'Rate of gas price that need to mul with current gas price', 1, types.float)
  .setAction(async (taskArgs) => {
    let totalCost = 0;
    let totalGasFee = 0;
    let tokenSymbol = 'BNB';
    const totalSummary = [];
    const beforeRun = Date.now();

    try {
      // Loading contents from CSV file
      const records = await readCsvFile(taskArgs.multisendCsv);
      const csvContents = records.map(record => {
        return {
          address: record[0],
          amount: record[1]
        }
      });

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
      if (taskArgs.token) {
        if (!ethers.utils.isAddress(taskArgs.token)) {
          console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Param --token address are invalid, please check again`);
          console.table([taskArgs.token]);
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

      const providerGasPrice = await provider.getGasPrice();
      const gasPrice = ethers.BigNumber.from(parseInt(multiply(
        providerGasPrice.toString(),
        taskArgs.gasRate.toString()
      )));

      if (!taskArgs.token) {
        // Send BNB
        for (let i = 0; i < csvContents.length; i++) {
          const summary = {
            id: i + 1,
            address: csvContents[i].address,
            amount: Number(csvContents[i].amount),
            symbol: tokenSymbol,
            startTime: formatedDate(new Date())
          }

          const tx = {
            to: csvContents[i].address,
            value: ethers.utils.parseEther(csvContents[i].amount),
            gasPrice: gasPrice
          }
          tx.gasLimit = await provider.estimateGas(tx);

          try {
            const transaction = await admin.sendTransaction(tx);
            const receipt = await transaction.wait();
            summary['status'] = 'SUCCESS';
            summary['txHash'] = receipt.transactionHash;
            summary['blockHash'] = receipt.blockHash;

            const gasFee = calGasFee(receipt);
            summary['gasFee'] = gasFee;
            summary['reason'] = '';

            totalGasFee += gasFee;
            totalCost += (Number(csvContents[i].amount));
          } catch (error) {
            summary['status'] = 'FAILED';
            summary['reason'] = error.toString();
            summary['txHash'] = '';
            summary['blockHash'] = '';
            summary['gasFee'] = 0;
          }

          summary['endTime'] = formatedDate(new Date());
          totalSummary.push(summary);
          printTable(summary);
        }
      } else {
        let ERC20Artifact;
        try {
          ERC20Artifact = require('../artifacts/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol/IERC20Metadata.json');
        } catch (error) {
          console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Please compile contracts by running below command before using this scripts!!!`);
          console.log(CONSOLE_LOG_RED_COLOR, `   ---> npx hardhat compile`);
          return;
        }

        const tokenContract = new ethers.Contract(taskArgs.token, ERC20Artifact.abi, admin);
        tokenSymbol = await tokenContract.symbol();
        const tokenDecimals = Number((await tokenContract.decimals()).toString());

        // Send token
        for (let i = 0; i < csvContents.length; i++) {
          const summary = {
            id: i + 1,
            address: csvContents[i].address,
            amount: Number(csvContents[i].amount),
            symbol: tokenSymbol,
            startTime: formatedDate(new Date())
          }

          try {
            const gasLimit = await tokenContract.estimateGas.transfer(
              csvContents[i].address,
              ethers.utils.parseUnits(csvContents[i].amount.toString(), tokenDecimals),
              { gasPrice }
            );

            const transaction = await tokenContract.transfer(
              csvContents[i].address,
              ethers.utils.parseUnits(csvContents[i].amount.toString(), tokenDecimals),
              { gasPrice, gasLimit }
            );

            const receipt = await transaction.wait();
            summary['status'] = 'SUCCESS';
            summary['txHash'] = receipt.transactionHash;
            summary['blockHash'] = receipt.blockHash;

            const gasFee = calGasFee(receipt);
            summary['gasFee'] = gasFee;
            summary['reason'] = '';

            totalGasFee += gasFee;
            totalCost += Number(csvContents[i].amount);
          } catch (error) {
            summary['status'] = 'FAILED';
            summary['reason'] = error.toString();
            summary['txHash'] = '';
            summary['blockHash'] = '';
            summary['gasFee'] = 0;
          }

          summary['endTime'] = formatedDate(new Date());
          totalSummary.push(summary);
          printTable(summary);
        }
      }

      console.log(CONSOLE_LOG_GREEN_COLOR, `\nSending successfully!!! Total send: ${totalCost} ${tokenSymbol} | Total gas fee: ${totalGasFee} BNB`);
    } catch (error) {
      console.log(CONSOLE_LOG_RED_COLOR, `\nMulti send failed! Total send: ${totalCost} ${tokenSymbol} | Total gas fee: ${totalGasFee} BNB`)
      console.log(error);
    }
    const afterRun = Date.now();
    console.log(CONSOLE_LOG_GREEN_COLOR, `\nTotal execute time ${afterRun - beforeRun}\n`);

    // Export results to csv
    const csv = new ObjectsToCsv(totalSummary);
    const fileName = `MultiSend_${Date.now()}.csv`;
    await csv.toDisk(`./${fileName}`);
    console.log(CONSOLE_LOG_GREEN_COLOR, `\nExported to csv file: ./${fileName}\n`);
  });
