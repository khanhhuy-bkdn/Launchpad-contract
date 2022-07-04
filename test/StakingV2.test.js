const { ethers, upgrades } = require("hardhat");
const { expect, use } = require("chai");
const { skipTime, acceptable } = require("./utils");
const {
  add,
  subtract,
  multiply,
  divide,
  compareTo,
} = require("js-big-decimal");

const MAX_INT =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

describe("StakingV2", () => {
  let admin, user1, user2, user3, user4;
  let gmi;
  let staking;
  const ONE_YEAR = 31556926;
  const MAX_TOKEN = 1500000000;
  const RATE_90_DAYS = 55492135971;
  const TIMESTAMP_90_DAYS = 7776000; //7889229;//7776000;
  const RATE_60_DAYS = 47564687975;
  const TIMESTAMP_60_DAYS = 5184000;
  const RATE = divide(175, 100);
  let CURRENT_TIME;
  beforeEach(async () => {
    const blockNumAfter = await ethers.provider.getBlockNumber();
    const blockAfter = await ethers.provider.getBlock(blockNumAfter);
    const timestampAfter = blockAfter.timestamp;

    CURRENT_TIME = timestampAfter;
    const accounts = await ethers.getSigners();
    admin = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    user3 = accounts[3];
    user4 = accounts[4];

    const Gmi = await ethers.getContractFactory("TokenGMI");
    gmi = await Gmi.deploy();
    await gmi.addController(admin.address);

    const Staking = await ethers.getContractFactory("Staking");
    staking = await upgrades.deployProxy(
      Staking,
      [
        admin.address,
        gmi.address, //staked token
        gmi.address, //reward token
        CURRENT_TIME,
        RATE_90_DAYS, //pool 90days
        TIMESTAMP_90_DAYS, //90days timestamp
        MAX_TOKEN,
      ],
      { unsafeAllow: ["constructor", "delegatecall"] }
    );
    await gmi.mint(admin.address, "1000000000");
    await gmi.mint(user1.address, "1000000000");
    await gmi.mint(user2.address, "1000000000");
    await gmi.mint(user3.address, "1000000000");
    await gmi.mint(user4.address, "1000000000");

    await gmi.connect(admin).approve(staking.address, MAX_INT);
    await gmi.connect(user1).approve(staking.address, MAX_INT);
    await gmi.connect(user2).approve(staking.address, MAX_INT);
  });

  describe("Deployment: ", async () => {
    it("should return default value (timestarted,...): ", async () => {
      expect(await staking.getTimeStarted()).to.equal(CURRENT_TIME);
      expect(await staking.getPoolDuration()).to.equal(TIMESTAMP_90_DAYS);
      expect(await staking.getStakeToken()).to.equal(gmi.address);
      expect(await staking.getStakedAmount()).to.equal(0);
      expect(await staking.getMaxStakedAmount()).to.equal(MAX_TOKEN);
      expect(await staking.getUserAmount(admin.address)).to.equal(0);
    });
  });
  describe("Check getter function: ", async () => {
    it("should getTimeStarted function return correct: ", async () => {
      expect(await staking.getTimeStarted()).to.equal(CURRENT_TIME);
    });
    it("should getPoolDuration function return correct: ", async () => {
      expect(await staking.getPoolDuration()).to.equal(TIMESTAMP_90_DAYS);
    });
    it("should getStakeToken function return correct: ", async () => {
      expect(await staking.getStakeToken()).to.equal(gmi.address);
    });
    it("should getStakedAmount function return correct: ", async () => {
      expect(await staking.getStakedAmount()).to.equal(0);
    });
    it("should getMaxStakedAmount function return correct: ", async () => {
      expect(await staking.getMaxStakedAmount()).to.equal(MAX_TOKEN);
    });
    it("should getUserAmount function return correct: ", async () => {
      expect(await staking.getUserAmount(admin.address)).to.equal(0);
    });
  });

  describe("Check setter function: ", async () => {
    it("should setRewardRate function return correct: ", async () => {
      await staking.setRewardRate(RATE_60_DAYS);
      expect(await staking.getRewardRate()).to.equal(RATE_60_DAYS);
    });
    it("should setStartTime function return correct: ", async () => {
      await staking.setStartTime(CURRENT_TIME + 1999);
      expect(await staking.getTimeStarted()).to.equal(add(CURRENT_TIME, 1999));
    });
    it("should setPoolDuration function return correct: ", async () => {
      await staking.setPoolDuration(TIMESTAMP_60_DAYS);
      expect(await staking.getPoolDuration()).to.equal(TIMESTAMP_60_DAYS);
    });
  });

  describe("Check pendingRewards function: ", async () => {
    it("should return amount of pending reward tokens 1 year: ", async () => {
      const Gmi = await ethers.getContractFactory("TokenGMI");
      gmi = await Gmi.deploy();
      await gmi.addController(admin.address);
      await gmi.mint(user1.address, "1000000000");

      const Staking = await ethers.getContractFactory("Staking");
      const staking = await upgrades.deployProxy(
        Staking,
        [
          admin.address,
          gmi.address, //staked token
          gmi.address, //reward token
          CURRENT_TIME,
          RATE_90_DAYS, //pool 90days
          ONE_YEAR, //90days timestamp
          MAX_TOKEN,
        ],
        { unsafeAllow: ["constructor", "delegatecall"] }
      );

      await gmi.connect(user1).approve(staking.address, MAX_INT);
      const deopositAmount = 10000;
      const tx = await staking.connect(user1).deposit(deopositAmount);
      await tx.wait();
      skipTime(ONE_YEAR);
      const pendingValue = await staking.pendingRewards(user1.address);

      const epsilon = 11;

      expect(acceptable(pendingValue, multiply(deopositAmount, RATE), epsilon))
        .to.be.true;
    });
    it("should return amount of pending reward tokens: ", async () => {
      const Gmi2 = await ethers.getContractFactory("TokenGMI");
      const gmi2 = await Gmi2.deploy();
      await gmi2.addController(admin.address);
      await gmi2.mint(user1.address, "1000000000");

      const Staking2 = await ethers.getContractFactory("Staking");
      const staking2 = await upgrades.deployProxy(
        Staking2,
        [
          admin.address,
          gmi2.address, //staked token
          gmi2.address, //reward token
          CURRENT_TIME,
          RATE_90_DAYS, //pool 90days
          TIMESTAMP_90_DAYS, //90days timestamp
          MAX_TOKEN,
        ],
        { unsafeAllow: ["constructor", "delegatecall"] }
      );

      await gmi2.connect(user1).approve(staking2.address, MAX_INT);
      const deopositAmount = 10000;
      await staking2.connect(user1).deposit(deopositAmount);
      skipTime(TIMESTAMP_90_DAYS);

      const pendingValue = await staking2.pendingRewards(user1.address);

      const epsilon = 3;

      expect(
        acceptable(
          pendingValue,
          divide(
            multiply(multiply(deopositAmount, RATE), TIMESTAMP_90_DAYS),
            ONE_YEAR
          ),
          epsilon
        )
      ).to.be.true;
    });
  });

  describe("Check deposit function: ", async () => {
    it("should deposit success and log event success: ", async () => {
      const Gmi2 = await ethers.getContractFactory("TokenGMI");
      const gmi2 = await Gmi2.deploy();
      await gmi2.addController(admin.address);
      await gmi2.mint(user1.address, "1000000000");

      const Staking2 = await ethers.getContractFactory("Staking");
      const staking2 = await upgrades.deployProxy(
        Staking2,
        [
          admin.address,
          gmi2.address, //staked token
          gmi2.address, //reward token
          CURRENT_TIME,
          RATE_90_DAYS, //pool 90days
          TIMESTAMP_90_DAYS, //90days timestamp
          MAX_TOKEN,
        ],
        { unsafeAllow: ["constructor", "delegatecall"] }
      );

      await gmi2.connect(user1).approve(staking2.address, MAX_INT);
      const amount = 10000;
      await expect(staking2.connect(user1).deposit(amount))
        .to.emit(staking2, "Deposited")
        .withArgs(user1.address, amount);
      expect(
        await staking2.connect(user1).getUserAmount(user1.address)
      ).to.equal(10000);
    });
    it("should revert when max staking limit has been reached: ", async () => {
      await expect(staking.deposit(add(MAX_TOKEN, 1))).to.be.revertedWith(
        "Staking: Max staking limit has been reached."
      );
    });
    it("should revert when staking has already ended: ", async () => {
      const timming = 900 * 24 * 60 * 60;
      skipTime(timming);
      await expect(staking.deposit(10000)).to.be.revertedWith(
        "Staking: Staking has already ended."
      );
    });
  });

  describe("Check withdraw function: ", async () => {
    it("should revert when staking pool has not expired yet: ", async () => {
      const Gmi2 = await ethers.getContractFactory("TokenGMI");
      const gmi2 = await Gmi2.deploy();
      await gmi2.addController(admin.address);
      await gmi2.mint(user1.address, "1000000000");

      const Staking2 = await ethers.getContractFactory("Staking");
      const staking2 = await upgrades.deployProxy(
        Staking2,
        [
          admin.address,
          gmi2.address, //staked token
          gmi2.address, //reward token
          CURRENT_TIME,
          RATE_90_DAYS, //pool 90days
          TIMESTAMP_90_DAYS, //90days timestamp
          MAX_TOKEN,
        ],
        { unsafeAllow: ["constructor", "delegatecall"] }
      );

      await gmi2.connect(user1).approve(staking2.address, MAX_INT);
      const timming = 1 * 24 * 60 * 60;
      await staking2.connect(user1).deposit(10000);
      skipTime(timming);
      await expect(staking2.withdraw(10000)).to.be.revertedWith(
        "Staking: StakingPool has not expired yet.."
      );
    });
    it("should revert when can not unstake more than staked amount: ", async () => {
      const Gmi2 = await ethers.getContractFactory("TokenGMI");
      const gmi2 = await Gmi2.deploy();
      await gmi2.addController(admin.address);
      await gmi2.mint(user1.address, "1000000000");

      const Staking2 = await ethers.getContractFactory("Staking");
      const staking2 = await upgrades.deployProxy(
        Staking2,
        [
          admin.address,
          gmi2.address, //staked token
          gmi2.address, //reward token
          CURRENT_TIME,
          RATE_90_DAYS, //pool 90days
          TIMESTAMP_90_DAYS, //90days timestamp
          MAX_TOKEN,
        ],
        { unsafeAllow: ["constructor", "delegatecall"] }
      );

      await gmi2.connect(user1).approve(staking2.address, MAX_INT);
      const timming = 90 * 24 * 60 * 60;
      await staking2.connect(user1).deposit(10000);
      skipTime(timming);
      await expect(staking2.connect(user1).withdraw(100000)).to.be.revertedWith(
        "Staking: Cannot unstake more than staked amount."
      );
    });
    it("should return true pending Reward for withdraw correct and log event success: ", async () => {
      const Gmi3 = await ethers.getContractFactory("TokenGMI");
      const gmi3 = await Gmi3.deploy();
      await gmi3.addController(admin.address);
      await gmi3.mint(admin.address, "1000000000");
      await gmi3.mint(user2.address, "1000000000");

      const Staking3 = await ethers.getContractFactory("Staking");
      const staking3 = await upgrades.deployProxy(
        Staking3,
        [
          admin.address,
          gmi3.address, //staked token
          gmi3.address, //reward token
          CURRENT_TIME,
          RATE_90_DAYS, //pool 90days
          TIMESTAMP_90_DAYS, //90days timestamp
          MAX_TOKEN,
        ],
        { unsafeAllow: ["constructor", "delegatecall"] }
      );

      await gmi3.connect(admin).approve(staking3.address, MAX_INT);
      await gmi3.connect(user2).approve(staking3.address, MAX_INT);
      const stakeAmount = 10000;
      await staking3.connect(user2).deposit(stakeAmount);
      const timming2d = 2 * 24 * 60 * 60;
      skipTime(timming2d);

      // caculate       APY 2days = timestamp(2day/1year) * APY 1year
      // pendingReward  pR        = APY 2days * total amount staked token
      const TWO_DAYS = 2 * 24 * 60 * 60;
      const APY_1YEAR = 1.75;
      const APY_2DAYS = (TWO_DAYS / ONE_YEAR) * APY_1YEAR;

      const epsilon = 10;

      const pR_2days = stakeAmount * APY_2DAYS;

      const pendingValue = await staking3
        .connect(user2)
        .pendingRewards(user2.address);
      expect(acceptable(pendingValue, pR_2days, epsilon)).to.be.true;

      await staking3.connect(user2).deposit(stakeAmount);

      const timming90d = 90 * 24 * 60 * 60;
      skipTime(timming90d);

      // caculate       APY 88days = timestamp(88day/1year) * APY 1year
      // pendingReward  pR        = APY 88days * total amount staked token
      const EIGHTY_EIGHT_DAYS = 88 * 24 * 60 * 60;
      const APY_88DAYS = (EIGHTY_EIGHT_DAYS / ONE_YEAR) * APY_1YEAR;

      const pR_88days = 2 * stakeAmount * APY_88DAYS;
      const pR_all = pR_88days + pR_2days;

      const value = await staking3.connect(user2).pendingRewards(user2.address);
      expect(acceptable(value, pR_all, epsilon)).to.be.true;

      await gmi3.connect(admin).transfer(staking3.address, 1000000);

      const totalAsset = 2 * stakeAmount;

      await expect(staking3.connect(user2).withdraw(totalAsset.toString()))
        .to.emit(staking3, "Withdrawed")
        .withArgs(user2.address, totalAsset.toString());
      expect(
        await staking3.connect(user2).pendingRewards(user2.address)
      ).to.equal(0);
    });
  });

  describe("Check EmergencyWithdraw function: ", async () => {
    it("should deposit success: ", async () => {
      await gmi.connect(admin).transfer(staking.address, 10000);
      await staking.connect(admin).EmergencyWithdraw();
      expect(await staking.getStakedAmount()).to.equal(
        await gmi.balanceOf(staking.address)
      );
    });
    it("should log event success: ", async () => {
      await gmi.connect(admin).transfer(staking.address, 10000);

      const token = await staking.getStakeToken();
      await expect(staking.connect(admin).EmergencyWithdraw())
        .to.emit(staking, "EmergencyWithdrawed")
        .withArgs(admin.address, token);
    });
  });
});
