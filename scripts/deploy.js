const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const upgrades = hre.upgrades;

async function main() {
  //Loading accounts
  const accounts = await ethers.getSigners();
  const addresses = accounts.map((item) => item.address);
  const admin = addresses[0];

  // Loading contract factory.
  const Gmi = await ethers.getContractFactory("TokenGMI");
  const Busd = await ethers.getContractFactory("CashTestToken");
  const Project = await ethers.getContractFactory("Project");
  const MemberCard = await ethers.getContractFactory("MemberCard");
  const Staking = await ethers.getContractFactory("Staking");
  const StakingNFT = await ethers.getContractFactory("StakingNFT");
  const Vendor = await ethers.getContractFactory("Vendor");
  const Vesting = await ethers.getContractFactory("Vesting");
  const VestingTGE = await ethers.getContractFactory("VestingTGE");
  const VestingLaunchPool = await ethers.getContractFactory("VestingLaunchPool");

  const blockNumAfter = await ethers.provider.getBlockNumber();
  const blockAfter = await ethers.provider.getBlock(blockNumAfter);
  const timestampAfter = blockAfter.timestamp;

  const CURRENT_TIME = timestampAfter; // process.env.TIME_START

  // Deploy contracts
  console.log(
    "=================================================================="
  );
  console.log("DEPLOY CONTRACTS");
  console.log(
    "=================================================================="
  );

  const memberCard = await MemberCard.deploy();
  await memberCard.deployed();
  console.log("MemberCard         deployed to:", memberCard.address);

  const gmi = await Gmi.deploy();
  await gmi.deployed();
  console.log("GMI Token          deployed to:", gmi.address);

  const busd = await Busd.deploy([admin]);
  await busd.deployed();
  console.log("Busd               deployed to:", busd.address);

  const staking90days = await upgrades.deployProxy(
    Staking,
    [
      admin,
      gmi.address, //staked token
      gmi.address, //reward token
      CURRENT_TIME,
      process.env.RATE_90_DAYS, //pool 90days
      process.env.TIMESTAMP_90_DAYS, //90days timestamp
      process.env.MAX_TOKEN_90,
    ],
    { unsafeAllow: ["constructor", "delegatecall"] }
  );
  await staking90days.deployed();
  console.log("staking90days      deployed to:", staking90days.address);
  const staking90daysVerify = await upgrades.erc1967.getImplementationAddress(
    staking90days.address
  );

  const staking60days = await upgrades.deployProxy(
    Staking,
    [
      admin,
      gmi.address, //staked token
      gmi.address, //reward token
      CURRENT_TIME,
      process.env.RATE_60_DAYS, //pool 90days
      process.env.TIMESTAMP_60_DAYS, //90days timestamp
      process.env.MAX_TOKEN_60,
    ],
    { unsafeAllow: ["constructor", "delegatecall"] }
  );
  await staking60days.deployed();
  console.log("staking60days      deployed to:", staking60days.address);
  const staking60daysVerify = await upgrades.erc1967.getImplementationAddress(
    staking60days.address
  );

  const stakingNFT = await upgrades.deployProxy(
    StakingNFT,
    [
      admin,
      gmi.address, //staked token
      gmi.address, //reward token
      memberCard.address,
      CURRENT_TIME,
      process.env.RATE_30_DAYS, //pool 90days
      process.env.TIMESTAMP_30_DAYS, //90days timestamp
      process.env.MAX_TOKEN_NFT,
    ],
    { unsafeAllow: ["constructor", "delegatecall"] }
  );
  await stakingNFT.deployed();
  console.log("stakingNFT         deployed to:", stakingNFT.address);
  const stakingNFTVerify = await upgrades.erc1967.getImplementationAddress(
    stakingNFT.address
  );

  const project = await upgrades.deployProxy(Project, [
    admin,
    gmi.address,
    busd.address,
    memberCard.address,
  ]);
  await project.deployed();
  const projectVerify = await upgrades.erc1967.getImplementationAddress(
    project.address
  );
  console.log("Project            deployed to:", project.address);
  console.log("Project verify     deployed to:", projectVerify);

  const vestingTGE = await upgrades.deployProxy(VestingTGE, [
    admin,
    gmi.address,
  ]);
  await vestingTGE.deployed();
  const vestingTGEVerify = await upgrades.erc1967.getImplementationAddress(
    vestingTGE.address
  );
  console.log("VestingTGE         deployed to:", vestingTGE.address);
  console.log("VestingTGE verify  deployed to:", vestingTGEVerify);

  const vestingLaunchPool = await upgrades.deployProxy(VestingLaunchPool, [admin, gmi.address]);
  await vestingLaunchPool.deployed();
  const vestingLaunchPoolVerify = await upgrades.erc1967.getImplementationAddress(vestingLaunchPool.address);
  console.log("VestingLaunchPool         deployed to:", vestingLaunchPool.address);
  console.log('VestingLaunchPool verify  deployed to:', vestingLaunchPoolVerify);

  const contractAddresses = {
    admin: admin,
    memberCard: memberCard.address,
    gmi: gmi.address,
    busd: busd.address,
    project: project.address,
    vestingTGE: vestingTGE.address,
    vestingLaunchPool: vestingLaunchPool.address,
    stakingNFT: stakingNFT.address,
    staking60days: staking60days.address,
    staking90days: staking90days.address,
  };

  await fs.writeFileSync("contracts.json", JSON.stringify(contractAddresses));

  const contractAddresses_verify = {
    admin: admin,
    memberCard: memberCard.address,
    gmi: gmi.address,
    busd: busd.address,
    project: projectVerify,
    vestingTGE: vestingTGEVerify,
    vestingLaunchPool: vestingLaunchPoolVerify,
    stakingNFT: stakingNFTVerify,
    staking60d: staking60daysVerify,
    staking90d: staking90daysVerify,
  };

  await fs.writeFileSync(
    "contracts-verify.json",
    JSON.stringify(contractAddresses_verify)
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
