const hre = require("hardhat");
const contracts = require("../contracts-verify.json");

async function main() {
  try {
    await hre.run("verify:verify", {
      address: "0xF8b3AB36E079598524f83094b98d7d2688CDE09C",
    });
  } catch (err) {
    console.log("err :>> ", err);
  }

  try {
    await hre.run("verify:verify", {
      address: "0x2277DEe895165127198beaAC84444ae0fb37aDf5",
    });
  } catch (err) {
    console.log("err :>> ", err);
  }

  // try {
  //   await hre.run("verify:verify", {
  //     address: contracts.busd,
  //     constructorArguments: [[contracts.admin]],
  //   });
  // } catch (err) {
  //   console.log("err :>> ", err);
  // }

  try {
    await hre.run("verify:verify", {
      address: "0x512f0133ded486c9d213e38Bb524cf5E45Fa08fa",
    });
  } catch (err) {
    console.log("err :>> ", err);
  }

  // try {
  //   await hre.run("verify:verify", {
  //     address: contracts.vestingTGE,
  //   });
  // } catch (err) {
  //   console.log("err :>> ", err);
  // }

  // // Duke NFT
  // try {
  //   await hre.run("verify:verify", {
  //     address: contracts.duke,
  //   });
  // } catch (err) {
  //   console.log("err :>> ", err);
  // }

  // try {
  //   await hre.run("verify:verify", {
  //     address: contracts.mysteriousBox,
  //   });
  // } catch (err) {
  //   console.log("err :>> ", err);
  // }

  // try {
  //   await hre.run("verify:verify", {
  //     address: contracts.dukeStaking,
  //   });
  // } catch (err) {
  //   console.log("err :>> ", err);
  // }

  // try {
  //   await hre.run("verify:verify", {
  //     address: contracts.stakingNFT,
  //   });
  // } catch (err) {
  //   console.log("err :>> ", err);
  // }

  // try {
  //   await hre.run("verify:verify", {
  //     address: contracts.staking60d,
  //   });
  // } catch (err) {
  //   console.log("err :>> ", err);
  // }

  // try {
  //   await hre.run("verify:verify", {
  //     address: contracts.staking90d,
  //   });
  // } catch (err) {
  //   console.log("err :>> ", err);
  // }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
