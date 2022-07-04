const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { skipTime, acceptable, setTime } = require("../utils");
const { BigNumber } = require("ethers");
const { subtract } = require("js-big-decimal");

describe("Staking Launchpad - Integration", () => {
    const SOLDIER_LIMIT = ethers.utils.parseUnits('150000', '18');
    const SOLDIER_RATE = 15854895992; // 50 % APY
    const poolDuration = 9 * 30 * 24 * 60 * 60; // 9 months
    const typeIdPool = 0; // 0 : Soldier || 1 : Pilot || 2 : General
    const MAX_BURN = "25000000000000000000000000";
    const ZERO = 0;
    
    before(async () => {
        const accounts = await ethers.getSigners();
        owner = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];
        user3 = accounts[3];

        const Gmi = await ethers.getContractFactory("TokenGMI");
        gmi = await Gmi.deploy();
        await gmi.addController(owner.address);
        const Rand = await ethers.getContractFactory("Rand");
        const rand = await Rand.deploy();
        Duke = await ethers.getContractFactory("Duke");
        duke = await upgrades.deployProxy(Duke, [
            owner.address,
            "Duke NFT",
            "CBT",
            rand.address
        ]);

        Staking = await ethers.getContractFactory("DukeStaking");
        staking = await upgrades.deployProxy(Staking, [
            owner.address,
            gmi.address,
            gmi.address,
            duke.address,
            SOLDIER_RATE,
            poolDuration,
            typeIdPool,
            SOLDIER_LIMIT
        ]);

        await staking.deployed();

        MAX_UINT256 = ethers.constants.MaxUint256 ;

        ONE_ETHER = ethers.utils.parseEther("1");
        DECIMAL = ethers.utils.parseUnits('1', '18');

        await gmi.mint(owner.address, MAX_BURN);
        await gmi.mint(user1.address, MAX_BURN);
        await gmi.mint(user2.address, MAX_BURN);
        await gmi.mint(user3.address, MAX_BURN);
        await gmi.mint(staking.address, MAX_BURN);

        await gmi.connect(owner).approve(staking.address, MAX_UINT256);
        await gmi.connect(user1).approve(staking.address, MAX_UINT256);
        await gmi.connect(user2).approve(staking.address, MAX_UINT256);

        await duke.setAdmin(staking.address, true);

        limitStaking = await staking.limitStaking();
    });

    it("User 1 stake less than max amount", async () => {
        const balance_contract_before = await gmi.balanceOf(staking.address);
        let tokenId = 0;
        let check = true;
        while (check) {
            await duke.mint(user1.address);
            const typeId = await duke.dukeInfos(tokenId);
            const owner = await duke.ownerOf(tokenId);
            tokenId++;
            if (owner == user1.address && typeId.typeId.toString() == '0') {
                check = false;
            }
        }

        const maxAmountOfUser1 = await staking.getMaxAmountStake(user1.address);
        expect(maxAmountOfUser1).to.equal(limitStaking);

        await staking.connect(user1).stake(maxAmountOfUser1.div(2));

        let userInfo = await staking.users(user1.address);

        expect(userInfo.totalAmount).to.equal(maxAmountOfUser1.div(2));
        expect(userInfo.pendingRewards).to.equal("0");

        const balance_contract_after = await gmi.balanceOf(staking.address);
        expect(balance_contract_after.sub(balance_contract_before)).to.equal(maxAmountOfUser1.div(2));
    });

    it("User 2 stake max amount", async () => {
        let tokenId = await duke.tokenCounter();
        let check = true;
        while (check) {
            await duke.mint(user2.address);
            const typeId = await duke.dukeInfos(tokenId);
            const owner = await duke.ownerOf(tokenId);
            tokenId++;
            if (owner == user2.address && typeId.typeId.toString() == '0') {
                check = false;
            }
        }

        const balance_contract_before = await gmi.balanceOf(staking.address);

        const maxAmountOfUser2 = await staking.getMaxAmountStake(user2.address);
        expect(maxAmountOfUser2).to.equal(limitStaking);

        await staking.connect(user2).stake(maxAmountOfUser2);

        const userInfo = await staking.users(user2.address);

        expect(userInfo.totalAmount).to.equal(maxAmountOfUser2);
        expect(userInfo.pendingRewards).to.equal("0");

        const balance_contract_after = await gmi.balanceOf(staking.address);
        expect(balance_contract_after.sub(balance_contract_before)).to.equal(maxAmountOfUser2);
    });

    it("User 1 buy 1 nft after 3 month and stake max amount", async () => {
        let tokenId = await duke.tokenCounter();
        let check = true;
        while (check) {
            await duke.mint(user1.address);
            const typeId = await duke.dukeInfos(tokenId);
            const owner = await duke.ownerOf(tokenId);
            tokenId++;
            if (owner == user1.address && typeId.typeId.toString() == '0') {
                check = false;
            }
        }
        const balance_contract_before = await gmi.balanceOf(staking.address);
        const maxAmountOfUser1 = await staking.getMaxAmountStake(user1.address);

        const _rewardRate = await staking.getRewardRate();

        const _startTime = await staking.getStartTime();
        const stakingEndTime = await staking.stakingEndTime();
        const time = _startTime.add(stakingEndTime).sub(60);
        const userInfo_before = await staking.users(user1.address);

        await setTime(time.toNumber());

        await staking.connect(user1).stake(maxAmountOfUser1);

        const userInfo_after = await staking.users(user1.address);
        expect(userInfo_after.totalAmount).to.equal(userInfo_before.totalAmount.add(maxAmountOfUser1), "Invalid total amount");

        const pendingReward_cal = userInfo_before.totalAmount.mul(_rewardRate).mul(stakingEndTime.sub(60)).div(DECIMAL);
        // expect(userInfo_after.pendingRewards).to.equal(pendingReward_cal, "Invalid pending reward");
        const epsilon = 1e16;
        expect(acceptable(userInfo_after.pendingRewards, pendingReward_cal, epsilon)).to.be.true;

        const balance_contract_after = await gmi.balanceOf(staking.address);
        expect(balance_contract_after.sub(balance_contract_before)).to.equal(maxAmountOfUser1);
    });

    it("User 1 buy 1 nft after 5 month and claim", async () => {
        const time = 2 * 30 * 86400;
        let tokenId = await duke.tokenCounter();
        let check = true;
        while (check) {
            await duke.mint(user1.address);
            const typeId = await duke.dukeInfos(tokenId);
            const owner = await duke.ownerOf(tokenId);
            tokenId++;
            if (owner == user1.address && typeId.typeId.toString() == '0') {
                check = false;
            }
        }

        const balance_contract_before = await gmi.balanceOf(staking.address);
        const balance_user_before = await gmi.balanceOf(user1.address);
        const _rewardRate = await staking.getRewardRate();

        const userInfo_before = await staking.users(user1.address);

        await skipTime(time);

        await staking.connect(user1).requestClaim();

        await skipTime(86401);

        await staking.connect(user1).claim();

        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);

        const balance_user_after = await gmi.balanceOf(user1.address);
        const balance_contract_after = await gmi.balanceOf(staking.address);

        const userInfo_after = await staking.users(user1.address);
        expect(userInfo_after.pendingRewards).to.equal("0", "Invalid total amount");

        const pendingReward_cal = userInfo_before.totalAmount.mul(_rewardRate).mul(subtract(block.timestamp, userInfo_before.lastClaim)).div(DECIMAL).add(userInfo_before.pendingRewards);
        const epsilon = 1e16;
        expect(acceptable(balance_contract_before.sub(balance_contract_after), pendingReward_cal, epsilon)).to.be.true;
        expect(balance_contract_before.sub(balance_contract_after)).to.equal(balance_user_after.sub(balance_user_before));
    });

    it("Check transfer token", async () => {
        const tokenIds = await duke.tokensOfOwnerByType(user1.address, '0')
        await expect(duke.connect(user1).transferFrom(user1.address, user3.address, tokenIds[0])).to.be.revertedWith("In unlockTime: you should stake it before transfer !");
    });

    it("User 1 unstake after 9 month", async () => {
        const time = 4 * 30 * 86400;
        const balance_contract_before = await gmi.balanceOf(staking.address);
        const balance_user_before = await gmi.balanceOf(user1.address);
        const _rewardRate = await staking.getRewardRate();
        const _poolDuration = await staking.getPoolDuration();

        const userInfo_before = await staking.users(user1.address);

        await skipTime(time);

        await staking.connect(user1).requestUnstake();

        await skipTime(86401);

        await staking.connect(user1).unstake(userInfo_before.totalAmount);

        const balance_user_after = await gmi.balanceOf(user1.address);
        const balance_contract_after = await gmi.balanceOf(staking.address);

        const userInfo_after = await staking.users(user1.address);
        expect(userInfo_after.pendingRewards).to.equal("0", "Invalid total amount");

        const total_cal = userInfo_before.totalAmount.mul(_rewardRate).mul(userInfo_before.startTime.add(_poolDuration).sub(userInfo_before.lastClaim)).div(DECIMAL).add(userInfo_before.pendingRewards).add(userInfo_before.totalAmount);

        const epsilon = 1e16;
        expect(acceptable(balance_contract_before.sub(balance_contract_after), total_cal, epsilon)).to.be.true;
        expect(balance_contract_before.sub(balance_contract_after)).to.equal(balance_user_after.sub(balance_user_before));
    });

    it("User 1 transfer token", async () => {
        const tokenIds = await duke.tokensOfOwnerByType(user1.address, '0')
        await duke.connect(user1).transferFrom(user1.address, user3.address, tokenIds[0]);
        const new_owner_token = await duke.ownerOf(tokenIds[0]);
        expect(new_owner_token).to.equal(user3.address);
    });

    it("User 2 unstake after 9 month", async () => {
        const balance_contract_before = await gmi.balanceOf(staking.address);
        const balance_user_before = await gmi.balanceOf(user2.address);
        const _rewardRate = await staking.getRewardRate();
        const _poolDuration = await staking.getPoolDuration();

        const userInfo_before = await staking.users(user2.address);
        await staking.connect(user2).requestUnstake();

        await skipTime(86401);

        await staking.connect(user2).unstake(userInfo_before.totalAmount);

        const balance_user_after = await gmi.balanceOf(user2.address);
        const balance_contract_after = await gmi.balanceOf(staking.address);

        const userInfo_after = await staking.users(user2.address);
        expect(userInfo_after.pendingRewards).to.equal("0", "Invalid total amount");

        const total_cal = userInfo_before.totalAmount.mul(_rewardRate).mul(userInfo_before.startTime.add(_poolDuration).sub(userInfo_before.lastClaim)).div(DECIMAL).add(userInfo_before.pendingRewards).add(userInfo_before.totalAmount);

        const epsilon = 1e16;
        expect(acceptable(balance_contract_before.sub(balance_contract_after), total_cal, epsilon)).to.be.true;
        expect(balance_contract_before.sub(balance_contract_after)).to.equal(balance_user_after.sub(balance_user_before));
    });
});
