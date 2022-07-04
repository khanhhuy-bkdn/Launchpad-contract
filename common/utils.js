const fs = require('fs');
const bigDecimal = require("js-big-decimal");
const ObjectsToCsv = require('objects-to-csv');
const { parse } = require('csv-parse');

const formatUnits = (value, unit, precision = 4) => {
  const formattedValue = ethers.utils.formatUnits(value, unit);
  return Number(bigDecimal.round(formattedValue, precision));
}

const formatEther = (value, precision = 4) => {
  const formattedValue = ethers.utils.formatEther(value);
  return Number(bigDecimal.round(formattedValue, precision));
}

const readCsvFile = async (path) => {
  const records = [];
  const parser = fs
    .createReadStream(path)
    .pipe(parse({
    // CSV options if any
    }));
  for await (const record of parser) {
    // Work with each record
    records.push(record);
  }
  return records;
};

const writeCsvFile = async (fileName, data) => {
  const csv = new ObjectsToCsv(data);
  await csv.toDisk(`./${fileName}`);
};

module.exports = {
  formatUnits,
  formatEther,
  readCsvFile,
  writeCsvFile
}
