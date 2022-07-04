const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { skipTime, acceptable, setTime } = require("./utils");
const { BigNumber } = require("ethers");

describe("Staking Launchpad", () => {
    const SOLDIER_LIMIT = ethers.utils.parseUnits('150000', '18');
    const SOLDIER_RATE = 15854895992; // 50 % APY
    const poolDuration = 9 * 30 * 24 * 60 * 60; // 9 months
    const typeIdPool = 0; // 0 : Soldier || 1 : Pilot || 2 : General
    const MAX_BURN = "25000000000000000000000000";
    const ZERO = 0;
    
    beforeEach(async () => {
        const accounts = await ethers.getSigners();
        owner = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];
        user3 = accounts[3];

        const Gmi = await ethers.getContractFactory("TokenGMI");
        gmi = await Gmi.deploy();
        await gmi.addController(owner.address);

        Staking = await ethers.getContractFactory("StakingLaunchpad");
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
    });

    describe("Deployment", async () => {
        it("should return owner address", async () => {
            const ownerAddress = await staking.owner();
            expect(ownerAddress).to.equal(owner.address);
        });
    });

    // GET FUNC
    describe("getStakeToken", async () => {
        it("should return staked token", async () => {
            expect(await staking.getStakeToken()).to.equal(gmi.address);
        });
    });

    describe("getStakedAmount", async () => {
        it("should return total staked amount", async () => {
            expect(await staking.getStakedAmount()).to.equal(0);
        });
    });

    describe("getPoolDuration", async () => {
        it("should return pool duration", async () => {
            expect(await staking.getPoolDuration()).to.equal(poolDuration);
        });
    });

    describe("getRewardRate", async () => {
        it("should return reward rate", async () => {
            expect(await staking.getRewardRate()).to.equal(SOLDIER_RATE);
        });
    });

    describe("getMaxAmountOf", async () => {
        it("should return max amount of staking limit", async () => {
            expect(await staking.getMaxAmountOf(owner.address)).to.equal(ZERO);
        });
    });

    describe("getUserAmount", async () => {
        it("should return amount of user", async () => {
            const tokenId = 0;
            await duke.mint(user1.address);
            const typeId = await duke.dukeInfos(tokenId);

            if (typeId.typeId.toString() == '0') {
                await staking.connect(user1).stake(ONE_ETHER);
                expect(await staking.getUserAmount(user1.address)).to.equal(ONE_ETHER);
            } else {
                await expect(staking.connect(user1).stake(ONE_ETHER)).to.be.revertedWith("Require to have NFT for staking in pool");
            }

        });
    });
    describe("getStartTime", async () => {
        it("should return start time of staking pool", async () => {
            expect(await staking.getStartTime()).to.equal(ZERO);
        });
    });

    // SET FUNC
    describe("setRewardRate", async () => {
        it("should change reward rate", async () => {
            const newRate = 1512300005610;
            await staking.setRewardRate(newRate);
            expect(await staking.getRewardRate()).to.equal(newRate);
        });
    });
    describe("setPoolDuration", async () => {
        it("should change pool duration", async () => {
            const newPoolDuration = 3 * 30 * 24 * 60 * 60;
            await staking.setPoolDuration(newPoolDuration);
            expect(await staking.getPoolDuration()).to.equal(newPoolDuration);
        });
    });

    describe("setStartTime", async () => {
        it("should change start time", async () => {
            const time = 1234567;
            await staking.setStartTime(time);
            expect(await staking.getStartTime()).to.equal(time);
        });
    });

    describe("setPendingUnstake", async () => {
        it("should change pending unstake time", async () => {
            const time = 1234567;
            await staking.setPendingUnstake(time);
            expect(await staking.pendingUnstake()).to.equal(time);
        });
    });

    describe("setStakingEndTime", async () => {
        it("should change staking end time", async () => {
            const time = 1234567;
            await staking.setStakingEndTime(time);
            expect(await staking.stakingEndTime()).to.equal(time);
        });
    });

    // // Others
    describe("stake", async () => {
        it("should revert when no NFT is staking active", async () => {
            await expect(staking.connect(user1).stake(ONE_ETHER)).to.be.revertedWith("Require to have NFT for staking in pool");
        });

        it("should revert when stake overtime 3 months", async () => {
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

            const overtime = 4 * 30 * 24 * 60 * 60;
            await staking.connect(user1).stake(ONE_ETHER);
            await skipTime(overtime);
            await expect(staking.connect(user1).stake(ONE_ETHER)).to.be.revertedWith("Staking has already ended");
            
        });

        it("should revert when max staking limit has been reached", async () => {
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

            await expect(staking.connect(user1).stake(SOLDIER_LIMIT.add(1))).to.be.revertedWith("Staking: Max staking limit has been reached.");
        });

        it("should stake success", async () => {
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

            await staking.connect(user1).stake(SOLDIER_LIMIT);
            expect(await staking.getUserAmount(user1.address)).to.equal(SOLDIER_LIMIT);
        });
    });

    describe("pendingRewards", async () => {
        beforeEach(async () => {
            tokenId = 0;
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
        });

        it("should return pending reward", async () => {
            const claimTime = 4 * 30 * 24 * 60 * 60;
            const _rewardRate = await staking.getRewardRate();

            await staking.connect(user1).stake(ONE_ETHER);
            await skipTime(claimTime);
            const pendingRewards = await staking.pendingRewards(user1.address);

            const epsilon = 1 / 100 * ONE_ETHER;
            expect(
                acceptable(pendingRewards.toString(), ONE_ETHER.mul(_rewardRate).mul(claimTime).div(DECIMAL), epsilon))
                .to.be.true;
        });
    });

    describe("requestUnstake", async () => {
        beforeEach(async () => {
            tokenId = 0;
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
        });

        it("should revert when not allow at this time for no NFT or on staking time", async () => {
            const claimTime = 4 * 30 * 24 * 60 * 60;
            await staking.connect(user1).stake(ONE_ETHER);
            await skipTime(claimTime);
            await expect(staking.connect(user1).requestUnstake()).to.be.revertedWith("Not allow unstake at this time");
           
        });

        it("should request success", async () => {
            const claimTime = 10 * 30 * 24 * 60 * 60; // 1 thangs
            await staking.connect(user1).stake(ONE_ETHER);
            await skipTime(claimTime);
            await staking.connect(user1).requestUnstake();

            const data = await staking.users(user1.address);
            expect(data.lazyUnstake.isRequested).to.equal(true);
            
        });
    });

    describe("requestClaim", async () => {
        beforeEach(async () => {
            tokenId = 0;
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
        });

        it("should revert when pool is not start", async () => {
            await expect(staking.connect(user1).requestClaim()).to.be.revertedWith("Pool is not start !");
        });

        it("should revert when more request", async () => {
            const claimTime = 4 * 30 * 24 * 60 * 60;
            await staking.connect(user1).stake(ONE_ETHER);
            await skipTime(claimTime);
            await staking.connect(user1).requestClaim();
            await expect(staking.connect(user1).requestClaim()).to.be.revertedWith("Requested !");
        });

        it("should request success", async () => {
            const claimTime = 4 * 30 * 24 * 60 * 60;
            await staking.connect(user1).stake(ONE_ETHER);
            await skipTime(claimTime);
            await staking.connect(user1).requestClaim();

            const data = await staking.users(user1.address);
            expect(data.lazyClaim.isRequested).to.equal(true);
        });
    });

    describe("claim", async () => {
        beforeEach(async () => {
            tokenId = 0;
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
        });

        it("should revert when NOT request and can claim after 24 hours ", async () => {
            await staking.connect(user1).stake(ONE_ETHER);

            await skipTime(10 * 30 * 24 * 60 * 60);
            await staking.connect(user1).requestUnstake();

            await skipTime(24 * 60 * 60 + 1);
            await staking.connect(user1).unstake(ONE_ETHER);

            await expect(staking.connect(user1).claim()).to.be.revertedWith("Please request and can claim after 24 hours");
        });

        it("should revert when amount of reward value equal to zero ", async () => {
            await staking.connect(user1).stake(ONE_ETHER);

            await skipTime(10 * 30 * 24 * 60 * 60);
            await staking.connect(user1).requestUnstake();

            await skipTime(24 * 60 * 60 + 1);
            await staking.connect(user1).unstake(ONE_ETHER);

            await staking.connect(user1).requestClaim();

            await skipTime(24 * 60 * 60 + 1);
            await expect(staking.connect(user1).claim()).to.be.revertedWith("Reward value equal to zero");
        });

        it("should claim success", async () => {
            await staking.connect(user1).stake(ONE_ETHER);

            await skipTime(24 * 60 * 60 + 1);
            await staking.connect(user1).requestClaim();
            let data = await staking.users(user1.address);

            expect(data.lazyClaim.isRequested).to.equal(true);

            await skipTime(24 * 60 * 60 + 1);
            await staking.connect(user1).claim();
            data = await staking.users(user1.address);

            expect(data.lazyClaim.isRequested).to.equal(false);
        });
    });

    describe("unstake", async () => {
        beforeEach(async () => {
            tokenId = 0;
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

            await staking.connect(user1).stake(ONE_ETHER);
        });

        it("should revert when staking pool for NFT not expired", async () => {
            const unstakeTime = 8 * 30 * 24 * 60 * 60 + 1;
            await skipTime(unstakeTime);

            await expect(staking.connect(user1).unstake(ONE_ETHER)).to.be.revertedWith("Staking: StakingPool for NFT has not expired yet..");
        });

        it("should revert when request not finish after 24 hours", async () => {
            const unstakeTime = 9 * 30 * 24 * 60 * 60 + 1;
            await skipTime(unstakeTime);

            await expect(staking.connect(user1).unstake(ONE_ETHER)).to.be.revertedWith("Please request and can withdraw after 24 hours");
        });

        it("should revert when connot unstake more than staked amount", async () => {
            const unstakeTime = 9 * 30 * 24 * 60 * 60 + 1;
            await skipTime(unstakeTime);
            await staking.connect(user1).requestUnstake();
            await skipTime(25 * 60 * 60);
            await expect(staking.connect(user1).unstake(MAX_BURN)).to.be.revertedWith("Staking: Cannot unstake more than staked amount.");
        });

        it("should unstake success", async () => {
            const unstakeTime = 9 * 30 * 24 * 60 * 60 + 1;
            await skipTime(unstakeTime);
            await staking.connect(user1).requestUnstake();

            // console.log((await staking.pendingRewards(user1.address)).toString());

            await skipTime(25 * 60 * 60);
            await staking.connect(user1).unstake(ONE_ETHER);

            // const pendingRewards = await staking.pendingRewards(user1.address);
            // expect(pendingRewards).to.equal(ZERO);

            await duke.connect(user1).transferFrom(user1.address, owner.address, tokenId - 1);
            const owner_of_token = await duke.ownerOf(tokenId - 1);
            expect(owner_of_token).to.equal(owner.address);
        });
    });

    describe("Check EmergencyWithdraw function", async () => {
        it("should deposit success", async () => {
            await gmi.connect(owner).transfer(staking.address, 10000);
            await staking.connect(owner).emergencyWithdraw();
            expect(await staking.getStakedAmount()).to.equal(
                await gmi.balanceOf(staking.address)
            );
        });
    });
});
