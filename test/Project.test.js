const { ethers } = require("hardhat");
const { expect } = require("chai");
const { getCurrentBlock, skipBlock } = require("./utils");
const {
  MAX_UINT256,
  ZERO_ADDRESS,
} = require("@openzeppelin/test-helpers/src/constants");
const Big = require("big.js");
const { add, divide, multiply } = require("js-big-decimal");

const allocationSize = "100000000000000000000000"; // 100,000 USD
const minStakeAmount = "1000000000000000000000"; // 1000 GMI
const maxStakeAmount = "10000000000000000000000"; // 10000 GMI
const fundingMinAllocation = "10000000000000000000"; // 10 USD
const fundingAllocationRate = "500000000000000000"; // rate is 0.5 / mean that stake 1 GMI => can funding 0.5 USD
const estimateTokenAllocationRate = "100000000000000000"; // rate is 0.1 / mean that fund 1 USD => receive 1 / 0.1 = 10 token
const blackHoleAddress = "0x0000000000000000000000000000000000000000";

describe("Project", () => {
  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    admin = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    user3 = accounts[3];
    user4 = accounts[4];
    fundingReceiver = accounts[10];

    const TokenGMI = await ethers.getContractFactory("TokenGMI");
    token = await TokenGMI.deploy();

    const CashTestToken = await ethers.getContractFactory("CashTestToken");
    busd = await CashTestToken.deploy([
      admin.address,
      user1.address,
      user2.address,
      user3.address,
    ]);

    const MemberCard = await ethers.getContractFactory("MemberCard");
    memberCard = await MemberCard.deploy();
    await memberCard.initialize(admin.address, "NFT", "NFT");

    const Rand = await ethers.getContractFactory("Rand");
    const rand = await Rand.deploy();

    const Duke = await ethers.getContractFactory("Duke");
    duke = await upgrades.deployProxy(Duke, [
      admin.address,
      "Duke NFT",
      "CBT",
      rand.address,
    ]);

    const Project = await ethers.getContractFactory("Project");
    project = await upgrades.deployProxy(Project, [
      admin.address,
      token.address,
      busd.address,
    ]);

    await memberCard.setVendor(project.address, true);
    await duke.connect(admin).setAdmin(project.address, true);

    await token.addController(admin.address);
    await token.mint(user1.address, "1000000000000000000000000"); // mint 1000,000 token GMI
    await token.mint(user2.address, "1000000000000000000000000"); // mint 1000,000 token GMI

    await token.connect(user1).approve(project.address, MAX_UINT256.toString());
    await busd.connect(user1).approve(project.address, MAX_UINT256.toString());
    await token.connect(user2).approve(project.address, MAX_UINT256.toString());
    await token.connect(user3).approve(project.address, MAX_UINT256.toString());
    await token.connect(user4).approve(project.address, MAX_UINT256.toString());

    tokens_general_user_1 = [];
    tokens_general_user_3 = [];
    tokens_general_user_2 = [];
    tokens_other_user_1 = [];
    while (tokens_general_user_1.length <= 3) {
      const tokenId = await duke.tokenCounter();
      await duke.mint(user1.address);
      const typeId = await duke.dukeInfos(tokenId);
      const owner = await duke.ownerOf(tokenId);
      if (owner == user1.address && typeId.typeId.toString() == "2") {
        tokens_general_user_1.push(tokenId);
      } else {
        tokens_other_user_1.push(tokenId);
      }
    }

    while (tokens_general_user_2.length <= 1) {
      const tokenId = await duke.tokenCounter();
      await duke.mint(user2.address);
      const typeId = await duke.dukeInfos(tokenId);
      const owner = await duke.ownerOf(tokenId);
      if (owner == user2.address && typeId.typeId.toString() == "2") {
        tokens_general_user_2.push(tokenId);
      }
    }

    while (tokens_general_user_3.length <= 1) {
      const tokenId = await duke.tokenCounter();
      await duke.mint(user3.address);
      const typeId = await duke.dukeInfos(tokenId);
      const owner = await duke.ownerOf(tokenId);
      if (owner == user3.address && typeId.typeId.toString() == "2") {
        tokens_general_user_3.push(tokenId);
      }
    }

    decimals = await token.decimals();
  });

  describe("createProject", () => {
    it("Success", async () => {
      expect(await project.latestProjectId()).equal(0, "Invalid project id");
      let currentBlock = await getCurrentBlock();
      const stakingStartBlockNumber = currentBlock + 100;
      const stakingEndBlockNumber = stakingStartBlockNumber + 100;
      const fundingStartBlockNumber = stakingEndBlockNumber + 100;
      const fundingEndBlockNumber = fundingStartBlockNumber + 100;
      const claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await project
        .connect(admin)
        .createProject(
          allocationSize,
          stakingStartBlockNumber,
          stakingEndBlockNumber,
          minStakeAmount,
          maxStakeAmount,
          fundingStartBlockNumber,
          fundingEndBlockNumber,
          fundingMinAllocation,
          estimateTokenAllocationRate,
          user1.address,
          claimBackStartBlockNumber,
          decimals
        );

      expect(await project.latestProjectId()).equal(1, "Invalid project id");
    });

    it("Only owner", async () => {
      let currentBlock = await getCurrentBlock();
      const stakingStartBlockNumber = currentBlock + 100;
      const stakingEndBlockNumber = stakingStartBlockNumber + 100;
      const fundingStartBlockNumber = stakingEndBlockNumber + 100;
      const fundingEndBlockNumber = fundingStartBlockNumber + 100;
      const claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await expect(
        project
          .connect(user1)
          .createProject(
            allocationSize,
            stakingStartBlockNumber,
            stakingEndBlockNumber,
            minStakeAmount,
            maxStakeAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            estimateTokenAllocationRate,
            user1.address,
            claimBackStartBlockNumber,
            decimals
          )
      ).to.revertedWith("Not admin or owner");
    });

    it("stakingStartBlockNumber <= current block number", async () => {
      let currentBlock = await getCurrentBlock();
      const stakingStartBlockNumber = currentBlock + 100;
      const stakingEndBlockNumber = stakingStartBlockNumber + 100;
      const fundingStartBlockNumber = stakingEndBlockNumber + 100;
      const fundingEndBlockNumber = fundingStartBlockNumber + 100;
      const claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await expect(
        project
          .connect(admin)
          .createProject(
            allocationSize,
            currentBlock - 1,
            stakingEndBlockNumber,
            minStakeAmount,
            maxStakeAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            estimateTokenAllocationRate,
            user1.address,
            claimBackStartBlockNumber,
            decimals
          )
      ).to.revertedWith("Invalid block number");

      currentBlock = await getCurrentBlock();
      await expect(
        project
          .connect(admin)
          .createProject(
            allocationSize,
            currentBlock,
            stakingEndBlockNumber,
            minStakeAmount,
            maxStakeAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            estimateTokenAllocationRate,
            user1.address,
            claimBackStartBlockNumber,
            decimals
          )
      ).to.revertedWith("Invalid block number");
    });

    it("stakingStartBlockNumber >= stakingEndBlockNumber", async () => {
      let currentBlock = await getCurrentBlock();
      const stakingStartBlockNumber = currentBlock + 100;
      const stakingEndBlockNumber = stakingStartBlockNumber + 100;
      const fundingStartBlockNumber = stakingEndBlockNumber + 100;
      const fundingEndBlockNumber = fundingStartBlockNumber + 100;
      const claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await expect(
        project
          .connect(admin)
          .createProject(
            allocationSize,
            stakingEndBlockNumber + 1,
            stakingEndBlockNumber,
            minStakeAmount,
            maxStakeAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            estimateTokenAllocationRate,
            user1.address,
            claimBackStartBlockNumber,
            decimals
          )
      ).to.revertedWith("Invalid block number");

      await expect(
        project
          .connect(admin)
          .createProject(
            allocationSize,
            stakingEndBlockNumber,
            stakingEndBlockNumber,
            minStakeAmount,
            maxStakeAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            estimateTokenAllocationRate,
            user1.address,
            claimBackStartBlockNumber,
            decimals
          )
      ).to.revertedWith("Invalid block number");
    });

    it("fundingStartBlockNumber <= stakingEndBlockNumber", async () => {
      let currentBlock = await getCurrentBlock();
      const stakingStartBlockNumber = currentBlock + 100;
      const stakingEndBlockNumber = stakingStartBlockNumber + 100;
      const fundingStartBlockNumber = stakingEndBlockNumber + 100;
      const fundingEndBlockNumber = fundingStartBlockNumber + 100;
      const claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await expect(
        project
          .connect(admin)
          .createProject(
            allocationSize,
            stakingStartBlockNumber,
            stakingEndBlockNumber,
            minStakeAmount,
            maxStakeAmount,
            stakingEndBlockNumber - 1,
            fundingEndBlockNumber,
            fundingMinAllocation,
            estimateTokenAllocationRate,
            user1.address,
            claimBackStartBlockNumber,
            decimals
          )
      ).to.revertedWith("Invalid block number");

      await expect(
        project
          .connect(admin)
          .createProject(
            allocationSize,
            stakingStartBlockNumber,
            stakingEndBlockNumber,
            minStakeAmount,
            maxStakeAmount,
            stakingEndBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            estimateTokenAllocationRate,
            user1.address,
            claimBackStartBlockNumber,
            decimals
          )
      ).to.revertedWith("Invalid block number");
    });

    it("fundingStartBlockNumber >= fundingEndBlockNumber", async () => {
      let currentBlock = await getCurrentBlock();
      const stakingStartBlockNumber = currentBlock + 100;
      const stakingEndBlockNumber = stakingStartBlockNumber + 100;
      const fundingStartBlockNumber = stakingEndBlockNumber + 100;
      const fundingEndBlockNumber = fundingStartBlockNumber + 100;
      const claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await expect(
        project
          .connect(admin)
          .createProject(
            allocationSize,
            stakingStartBlockNumber,
            stakingEndBlockNumber,
            minStakeAmount,
            maxStakeAmount,
            fundingEndBlockNumber + 1,
            fundingEndBlockNumber,
            fundingMinAllocation,
            estimateTokenAllocationRate,
            user1.address,
            claimBackStartBlockNumber,
            decimals
          )
      ).to.revertedWith("Invalid block number");

      await expect(
        project
          .connect(admin)
          .createProject(
            allocationSize,
            stakingStartBlockNumber,
            stakingEndBlockNumber,
            minStakeAmount,
            maxStakeAmount,
            fundingEndBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            estimateTokenAllocationRate,
            user1.address,
            claimBackStartBlockNumber,
            decimals
          )
      ).to.revertedWith("Invalid block number");
    });

    it("minStakeAmount > maxStakeAmount", async () => {
      let currentBlock = await getCurrentBlock();
      const stakingStartBlockNumber = currentBlock + 100;
      const stakingEndBlockNumber = stakingStartBlockNumber + 100;
      const fundingStartBlockNumber = stakingEndBlockNumber + 100;
      const fundingEndBlockNumber = fundingStartBlockNumber + 100;
      const claimBackStartBlockNumber = fundingEndBlockNumber + 100;
      const minStakeAmount = "1000000000000000000000";
      const maxStakeAmount = "100000000000000000000";

      await expect(
        project
          .connect(admin)
          .createProject(
            allocationSize,
            stakingStartBlockNumber,
            stakingEndBlockNumber,
            minStakeAmount,
            maxStakeAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            estimateTokenAllocationRate,
            user1.address,
            claimBackStartBlockNumber,
            decimals
          )
      ).revertedWith("Invalid stake min amount");
    });
  });

  describe("setConfigBlockNumber", () => {
    beforeEach(async () => {
      currentBlock = await getCurrentBlock();
      stakingStartBlockNumber = currentBlock + 100;
      stakingEndBlockNumber = stakingStartBlockNumber + 100;
      fundingStartBlockNumber = stakingEndBlockNumber + 100;
      fundingEndBlockNumber = fundingStartBlockNumber + 100;
      claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await project
        .connect(admin)
        .createProject(
          allocationSize,
          stakingStartBlockNumber,
          stakingEndBlockNumber,
          minStakeAmount,
          maxStakeAmount,
          fundingStartBlockNumber,
          fundingEndBlockNumber,
          fundingMinAllocation,
          estimateTokenAllocationRate,
          user1.address,
          claimBackStartBlockNumber,
          decimals
        );
      last_project_id = await project.latestProjectId();
    });

    it("Shoule exception Not admin or owner", async () => {
      const currentBlock = await getCurrentBlock();
      const stakingStartBlockNumber = currentBlock + 100;
      const stakingEndBlockNumber = stakingStartBlockNumber + 100;
      const fundingStartBlockNumber = stakingEndBlockNumber + 100;
      const fundingEndBlockNumber = fundingStartBlockNumber + 100;
      const claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await expect(
        project
          .connect(user1)
          .setConfigBlockNumber(
            last_project_id,
            stakingStartBlockNumber,
            stakingEndBlockNumber,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            claimBackStartBlockNumber
          )
      ).revertedWith("Not admin or owner");

      await project
        .connect(admin)
        .setConfigBlockNumber(
          last_project_id,
          stakingStartBlockNumber,
          stakingEndBlockNumber,
          fundingStartBlockNumber,
          fundingEndBlockNumber,
          claimBackStartBlockNumber
        );

      await project.connect(admin).setAdmin(user1.address, true);
      await project
        .connect(user1)
        .setConfigBlockNumber(
          last_project_id,
          stakingStartBlockNumber,
          stakingEndBlockNumber,
          fundingStartBlockNumber,
          fundingEndBlockNumber,
          claimBackStartBlockNumber
        );
    });

    it("Shoule exception Invalid block number", async () => {
      await expect(
        project
          .connect(admin)
          .setConfigBlockNumber(
            last_project_id,
            0,
            stakingEndBlockNumber,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            claimBackStartBlockNumber
          )
      ).revertedWith("Invalid block number");

      await expect(
        project
          .connect(admin)
          .setConfigBlockNumber(
            last_project_id,
            stakingStartBlockNumber,
            stakingStartBlockNumber,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            claimBackStartBlockNumber
          )
      ).revertedWith("Invalid block number");

      await expect(
        project
          .connect(admin)
          .setConfigBlockNumber(
            last_project_id,
            stakingStartBlockNumber,
            stakingEndBlockNumber,
            stakingEndBlockNumber,
            fundingEndBlockNumber,
            claimBackStartBlockNumber
          )
      ).revertedWith("Invalid block number");

      await expect(
        project
          .connect(admin)
          .setConfigBlockNumber(
            last_project_id,
            stakingStartBlockNumber,
            stakingEndBlockNumber,
            fundingStartBlockNumber,
            fundingStartBlockNumber,
            claimBackStartBlockNumber
          )
      ).revertedWith("Invalid block number");

      await expect(
        project
          .connect(admin)
          .setConfigBlockNumber(
            last_project_id,
            stakingStartBlockNumber,
            stakingEndBlockNumber,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingEndBlockNumber
          )
      ).revertedWith("Invalid block number");
    });

    it("Success", async () => {
      await project
        .connect(admin)
        .setConfigBlockNumber(
          last_project_id,
          stakingStartBlockNumber,
          stakingEndBlockNumber,
          fundingStartBlockNumber,
          fundingEndBlockNumber,
          claimBackStartBlockNumber
        );
      const projectInfo = await project.getProjectInfo(1);
      expect(projectInfo.stakeInfo.startBlockNumber).equal(
        stakingStartBlockNumber,
        "Invalid stakingStartBlockNumber"
      );

      expect(projectInfo.stakeInfo.endBlockNumber).equal(
        stakingEndBlockNumber,
        "Invalid stakingEndBlockNumber"
      );

      expect(projectInfo.fundingInfo.startBlockNumber).equal(
        fundingStartBlockNumber,
        "Invalid fundingStartBlockNumber"
      );

      expect(projectInfo.fundingInfo.endBlockNumber).equal(
        fundingEndBlockNumber,
        "Invalid fundingEndBlockNumber"
      );

      expect(projectInfo.claimBackInfo.startBlockNumber).equal(
        claimBackStartBlockNumber,
        "Invalid claimBackStartBlockNumber"
      );
    });
  });

  describe("setAllocationSize", () => {
    beforeEach(async () => {
      currentBlock = await getCurrentBlock();
      stakingStartBlockNumber = currentBlock + 100;
      stakingEndBlockNumber = stakingStartBlockNumber + 100;
      fundingStartBlockNumber = stakingEndBlockNumber + 100;
      fundingEndBlockNumber = fundingStartBlockNumber + 100;
      claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await project
        .connect(admin)
        .createProject(
          allocationSize,
          stakingStartBlockNumber,
          stakingEndBlockNumber,
          minStakeAmount,
          maxStakeAmount,
          fundingStartBlockNumber,
          fundingEndBlockNumber,
          fundingMinAllocation,
          estimateTokenAllocationRate,
          user1.address,
          claimBackStartBlockNumber,
          decimals
        );
    });

    it("Only owner", async () => {
      await expect(
        project.connect(user1).setAllocationSize(1, "10")
      ).revertedWith("Not admin or owner");
      expect(await project.connect(admin).setAllocationSize(1, "10")).ok;
    });

    it("Invalid project allocation size", async () => {
      await expect(project.setAllocationSize(1, "0")).revertedWith(
        "Invalid project allocation size"
      );
    });

    it("Success", async () => {
      let projectInfo = await project.getProjectInfo(1);
      expect(projectInfo.allocationSize).equal(allocationSize);
      await project.setAllocationSize(1, "50");
      projectInfo = await project.getProjectInfo(1);
      expect(projectInfo.allocationSize).equal("50");
    });
  });

  describe("setEstimateTokenAllocationRate", () => {
    beforeEach(async () => {
      currentBlock = await getCurrentBlock();
      stakingStartBlockNumber = currentBlock + 100;
      stakingEndBlockNumber = stakingStartBlockNumber + 100;
      fundingStartBlockNumber = stakingEndBlockNumber + 100;
      fundingEndBlockNumber = fundingStartBlockNumber + 100;
      claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await project
        .connect(admin)
        .createProject(
          allocationSize,
          stakingStartBlockNumber,
          stakingEndBlockNumber,
          minStakeAmount,
          maxStakeAmount,
          fundingStartBlockNumber,
          fundingEndBlockNumber,
          fundingMinAllocation,
          estimateTokenAllocationRate,
          user1.address,
          claimBackStartBlockNumber,
          decimals
        );
    });

    it("Only owner", async () => {
      await expect(
        project.connect(user1).setEstimateTokenAllocationRate(1, "10")
      ).revertedWith("Not admin or owner");
      expect(
        await project.connect(admin).setEstimateTokenAllocationRate(1, "10")
      ).ok;
    });

    it("Invalid project estimate token allocation rate", async () => {
      await expect(project.setEstimateTokenAllocationRate(1, "0")).revertedWith(
        "Invalid project estimate token allocation rate"
      );
    });

    it("Success", async () => {
      let projectInfo = await project.getProjectInfo(1);
      expect(projectInfo.fundingInfo.estimateTokenAllocationRate).equal(
        estimateTokenAllocationRate
      );
      await project.setEstimateTokenAllocationRate(1, "50");
      projectInfo = await project.getProjectInfo(1);
      expect(projectInfo.fundingInfo.estimateTokenAllocationRate).equal("50");
    });
  });

  describe("setMinStakeAmount", () => {
    beforeEach(async () => {
      currentBlock = await getCurrentBlock();
      stakingStartBlockNumber = currentBlock + 100;
      stakingEndBlockNumber = stakingStartBlockNumber + 100;
      fundingStartBlockNumber = stakingEndBlockNumber + 100;
      fundingEndBlockNumber = fundingStartBlockNumber + 100;
      claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await project
        .connect(admin)
        .createProject(
          allocationSize,
          stakingStartBlockNumber,
          stakingEndBlockNumber,
          minStakeAmount,
          maxStakeAmount,
          fundingStartBlockNumber,
          fundingEndBlockNumber,
          fundingMinAllocation,
          estimateTokenAllocationRate,
          user1.address,
          claimBackStartBlockNumber,
          decimals
        );
    });

    it("Only owner", async () => {
      await expect(
        project.connect(user1).setMinStakeAmount(1, "10")
      ).revertedWith("Not admin or owner");
      expect(await project.connect(admin).setMinStakeAmount(1, "10")).ok;
    });

    it("Invalid min of stake amount", async () => {
      await expect(project.setMinStakeAmount(1, "0")).revertedWith(
        "Invalid min of stake amount"
      );
      await expect(
        project.setMinStakeAmount(1, maxStakeAmount + 100)
      ).revertedWith("Invalid min of stake amount");
    });

    it("Success", async () => {
      let projectInfo = await project.getProjectInfo(1);
      expect(projectInfo.stakeInfo.minStakeAmount).equal(minStakeAmount);
      await project.setMinStakeAmount(1, "50");
      projectInfo = await project.getProjectInfo(1);
      expect(projectInfo.stakeInfo.minStakeAmount).equal("50");
    });
  });

  describe("setMaxStakeAmount", () => {
    beforeEach(async () => {
      currentBlock = await getCurrentBlock();
      stakingStartBlockNumber = currentBlock + 100;
      stakingEndBlockNumber = stakingStartBlockNumber + 100;
      fundingStartBlockNumber = stakingEndBlockNumber + 100;
      fundingEndBlockNumber = fundingStartBlockNumber + 100;
      claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await project
        .connect(admin)
        .createProject(
          allocationSize,
          stakingStartBlockNumber,
          stakingEndBlockNumber,
          minStakeAmount,
          maxStakeAmount,
          fundingStartBlockNumber,
          fundingEndBlockNumber,
          fundingMinAllocation,
          estimateTokenAllocationRate,
          user1.address,
          claimBackStartBlockNumber,
          decimals
        );
    });

    it("Only owner", async () => {
      await expect(
        project.connect(user1).setMaxStakeAmount(1, "10")
      ).revertedWith("Not admin or owner");
      expect(await project.connect(admin).setMaxStakeAmount(1, "10")).ok;
    });

    it("Invalid limit of stake amount", async () => {
      await expect(project.setMaxStakeAmount(1, "0")).revertedWith(
        "Invalid limit of stake amount"
      );
    });

    it("Success", async () => {
      let projectInfo = await project.getProjectInfo(1);
      expect(projectInfo.stakeInfo.maxStakeAmount).equal(maxStakeAmount);
      await project.setMaxStakeAmount(1, "50");
      projectInfo = await project.getProjectInfo(1);
      expect(projectInfo.stakeInfo.maxStakeAmount).equal("50");
    });
  });

  describe("setFundingReceiver", () => {
    beforeEach(async () => {
      currentBlock = await getCurrentBlock();
      stakingStartBlockNumber = currentBlock + 100;
      stakingEndBlockNumber = stakingStartBlockNumber + 100;
      fundingStartBlockNumber = stakingEndBlockNumber + 100;
      fundingEndBlockNumber = fundingStartBlockNumber + 100;
      claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await project
        .connect(admin)
        .createProject(
          allocationSize,
          stakingStartBlockNumber,
          stakingEndBlockNumber,
          minStakeAmount,
          maxStakeAmount,
          fundingStartBlockNumber,
          fundingEndBlockNumber,
          fundingMinAllocation,
          estimateTokenAllocationRate,
          user1.address,
          claimBackStartBlockNumber,
          decimals
        );
    });

    it("Only owner", async () => {
      await expect(
        project.connect(user1).setFundingReceiver(1, user2.address)
      ).revertedWith("Not admin or owner");
      expect(await project.connect(admin).setFundingReceiver(1, user2.address))
        .ok;
    });

    it("Invalid funding receiver", async () => {
      await expect(
        project.setFundingReceiver(1, blackHoleAddress)
      ).revertedWith("Invalid funding receiver");
    });

    it("Success", async () => {
      let projectInfo = await project.getProjectInfo(1);
      expect(projectInfo.fundingInfo.fundingReceiver).equal(user1.address);
      await project.setFundingReceiver(1, user2.address);
      projectInfo = await project.getProjectInfo(1);
      expect(projectInfo.fundingInfo.fundingReceiver).equal(user2.address);
    });
  });

  describe("setContracts", () => {
    it("Only owner", async () => {
      await expect(
        project.connect(user1).setContracts(user1.address, user2.address)
      ).revertedWith("Not admin or owner");
    });

    it("Invalid contract address", async () => {
      await expect(
        project.connect(admin).setContracts(ZERO_ADDRESS, user2.address)
      ).revertedWith("Invalid contract address");
      await expect(
        project.connect(admin).setContracts(user1.address, ZERO_ADDRESS)
      ).revertedWith("Invalid contract address");
    });

    it("Success", async () => {
      await project.connect(admin).setContracts(user1.address, user2.address);
      expect(await project.gmi()).equal(user1.address);
      expect(await project.busd()).equal(user2.address);
    });
  });

  describe("setAdmin", () => {
    beforeEach(async () => {
      currentBlock = await getCurrentBlock();
      stakingStartBlockNumber = currentBlock + 100;
      stakingEndBlockNumber = stakingStartBlockNumber + 100;
      fundingStartBlockNumber = stakingEndBlockNumber + 100;
      fundingEndBlockNumber = fundingStartBlockNumber + 100;
      claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await project
        .connect(admin)
        .createProject(
          allocationSize,
          stakingStartBlockNumber,
          stakingEndBlockNumber,
          minStakeAmount,
          maxStakeAmount,
          fundingStartBlockNumber,
          fundingEndBlockNumber,
          fundingMinAllocation,
          estimateTokenAllocationRate,
          user1.address,
          claimBackStartBlockNumber,
          decimals
        );
      last_project_id = await project.latestProjectId();
    });

    it("Success", async () => {
      await project
        .connect(admin)
        .setConfigBlockNumber(
          last_project_id,
          stakingStartBlockNumber,
          stakingEndBlockNumber,
          fundingStartBlockNumber,
          fundingEndBlockNumber,
          claimBackStartBlockNumber
        );

      await project.connect(admin).setAdmin(user1.address, true);
      await project
        .connect(user1)
        .setConfigBlockNumber(
          last_project_id,
          stakingStartBlockNumber,
          stakingEndBlockNumber,
          fundingStartBlockNumber,
          fundingEndBlockNumber,
          claimBackStartBlockNumber
        );
    });

    it("Should exception Only owner", async () => {
      await expect(
        project
          .connect(user1)
          .setConfigBlockNumber(
            last_project_id,
            stakingStartBlockNumber,
            stakingEndBlockNumber,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            claimBackStartBlockNumber
          )
      ).revertedWith("Not admin or owner");
    });
  });

  describe("stake", () => {
    beforeEach(async () => {
      currentBlock = await getCurrentBlock();
      stakingStartBlockNumber = currentBlock + 100;
      stakingEndBlockNumber = stakingStartBlockNumber + 100;
      fundingStartBlockNumber = stakingEndBlockNumber + 100;
      fundingEndBlockNumber = fundingStartBlockNumber + 100;
      claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await project
        .connect(admin)
        .createProject(
          allocationSize,
          stakingStartBlockNumber,
          stakingEndBlockNumber,
          minStakeAmount,
          maxStakeAmount,
          fundingStartBlockNumber,
          fundingEndBlockNumber,
          fundingMinAllocation,
          estimateTokenAllocationRate,
          user1.address,
          claimBackStartBlockNumber,
          decimals
        );

      projectId = await project.latestProjectId();
    });

    it("Staking has not started yet", async () => {
      await expect(
        project.connect(user1).stake(projectId, maxStakeAmount)
      ).to.revertedWith("Staking has not started yet");
    });

    it("Staking has ended", async () => {
      await skipBlock(200);
      await expect(
        project.connect(user1).stake(projectId, maxStakeAmount)
      ).to.revertedWith("Staking has ended");
    });

    it("You already staking", async () => {
      await skipBlock(100);
      await project.connect(user1).stake(projectId, maxStakeAmount);
      await expect(
        project.connect(user1).stake(projectId, maxStakeAmount)
      ).to.revertedWith("You already staking");
    });

    it("Not enough stake amount", async () => {
      await skipBlock(100);
      await expect(
        project.connect(user1).stake(projectId, "0")
      ).to.revertedWith("Not enough stake amount");

      await expect(
        project.connect(user1).stake(projectId, "10000")
      ).to.revertedWith("Not enough stake amount");
    });

    it("Amount exceed limit stake amount", async () => {
      await skipBlock(100);
      await expect(
        project.connect(user1).stake(projectId, maxStakeAmount + 1)
      ).to.revertedWith("Amount exceed limit stake amount");
    });

    it("Stake success", async () => {
      const tokenBalanceOfProject_before = await token.balanceOf(
        project.address
      );
      const tokenBalanceOfUser_before = await token.balanceOf(user1.address);

      await skipBlock(100);
      await project.connect(user1).stake(projectId, maxStakeAmount);

      const tokenBalanceOfProject_after = await token.balanceOf(
        project.address
      );
      const tokenBalanceOfUser_after = await token.balanceOf(user1.address);

      expect(
        tokenBalanceOfProject_after.sub(tokenBalanceOfProject_before)
      ).to.be.equal(maxStakeAmount);
      expect(
        tokenBalanceOfUser_before.sub(tokenBalanceOfUser_after)
      ).to.be.equal(maxStakeAmount);

      const stakeInfo = await project.getStakeInfo(projectId);
      expect(stakeInfo.stakedTotalAmount).to.be.equal(maxStakeAmount);

      const userInfo = await project.getUserInfo(projectId, user1.address);
      expect(userInfo.stakedAmount).to.be.equal(maxStakeAmount);
    });
  });

  describe("stakeWithNFT", () => {
    beforeEach(async () => {
      currentBlock = await getCurrentBlock();
      stakingStartBlockNumber = currentBlock + 100;
      stakingEndBlockNumber = stakingStartBlockNumber + 100;
      fundingStartBlockNumber = stakingEndBlockNumber + 100;
      fundingEndBlockNumber = fundingStartBlockNumber + 100;
      claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await project
        .connect(admin)
        .createProject(
          allocationSize,
          stakingStartBlockNumber,
          stakingEndBlockNumber,
          minStakeAmount,
          maxStakeAmount,
          fundingStartBlockNumber,
          fundingEndBlockNumber,
          fundingMinAllocation,
          estimateTokenAllocationRate,
          user1.address,
          claimBackStartBlockNumber,
          decimals
        );

      projectId = await project.latestProjectId();
      await token.connect(admin).mint(user3.address, "999000000000000000000");

      await project.connect(admin).setNftPermitted(duke.address, true);
    });

    it("Staking has not started yet", async () => {
      await expect(
        project
          .connect(user1)
          .stakeWithNFT(projectId, duke.address, tokens_general_user_1[0])
      ).to.revertedWith("Staking has not started yet");
    });

    it("Staking has ended", async () => {
      await skipBlock(200);
      await expect(
        project
          .connect(user1)
          .stakeWithNFT(projectId, duke.address, tokens_general_user_1[0])
      ).to.revertedWith("Staking has ended");
    });

    it("You already staking", async () => {
      await skipBlock(100);
      await project
        .connect(user1)
        .stakeWithNFT(projectId, duke.address, tokens_general_user_1[0]);
      await expect(
        project
          .connect(user1)
          .stakeWithNFT(projectId, duke.address, tokens_general_user_1[1])
      ).to.revertedWith("You already staking");
    });

    it("NFT has not permitted", async () => {
      await memberCard
        .connect(admin)
        .setExpireTime(0, divide(Date.now(), 1000, 0));
      await skipBlock(100);
      await expect(
        project.connect(user1).stakeWithNFT(projectId, memberCard.address, 0)
      ).to.revertedWith("NFT has not permitted");
    });

    it("Unauthorised use of NFT", async () => {
      await skipBlock(100);
      await expect(
        project
          .connect(user2)
          .stakeWithNFT(projectId, duke.address, tokens_general_user_1[0])
      ).to.revertedWith("Unauthorised use of NFT");
    });

    it("Invalid NFT", async () => {
      await memberCard
        .connect(admin)
        .setExpireTime(0, divide(Date.now(), 1000, 0));
      await skipBlock(100);
      await expect(
        project
          .connect(user1)
          .stakeWithNFT(projectId, duke.address, tokens_other_user_1[0])
      ).to.revertedWith("Invalid NFT");
    });

    it("Token balance is not enough", async () => {
      await skipBlock(100);
      await expect(
        project
          .connect(user3)
          .stakeWithNFT(projectId, duke.address, tokens_general_user_3[0])
      ).to.revertedWith("Token balance is not enough");
    });

    it("Stake success", async () => {
      const tokenBalanceOfProject_before = await token.balanceOf(
        project.address
      );
      const tokenBalanceOfUser_before = await token.balanceOf(user1.address);

      await skipBlock(100);
      await project
        .connect(user1)
        .stakeWithNFT(projectId, duke.address, tokens_general_user_1[0]);

      const tokenBalanceOfProject_after = await token.balanceOf(
        project.address
      );
      const tokenBalanceOfUser_after = await token.balanceOf(user1.address);

      expect(tokenBalanceOfProject_after).to.be.equal(
        tokenBalanceOfProject_before
      );
      expect(tokenBalanceOfUser_before).to.be.equal(tokenBalanceOfUser_after);

      const stakeInfo = await project.getStakeInfo(projectId);
      expect(stakeInfo.stakedTotalAmount).to.be.equal("0");

      const userInfo = await project.getUserInfo(projectId, user1.address);
      expect(userInfo.stakedAmount).to.be.equal("0");
      expect(userInfo.allocatedPortion).to.be.equal(maxStakeAmount);
      expect(userInfo.usedNft).to.be.equal("1");
    });
  });

  describe("funding", () => {
    beforeEach(async () => {
      currentBlock = await getCurrentBlock();
      stakingStartBlockNumber = currentBlock + 100;
      stakingEndBlockNumber = stakingStartBlockNumber + 100;
      fundingStartBlockNumber = stakingEndBlockNumber + 100;
      fundingEndBlockNumber = fundingStartBlockNumber + 100;
      claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await project
        .connect(admin)
        .createProject(
          allocationSize,
          stakingStartBlockNumber,
          stakingEndBlockNumber,
          minStakeAmount,
          maxStakeAmount,
          fundingStartBlockNumber,
          fundingEndBlockNumber,
          fundingMinAllocation,
          estimateTokenAllocationRate,
          user1.address,
          claimBackStartBlockNumber,
          decimals
        );

      projectId = await project.latestProjectId();
      await skipBlock(100);
      await project.connect(user1).stake(projectId, maxStakeAmount);
      await skipBlock(100);
      await project.addUsersToWhitelist(projectId, [user1.address]);
    });

    it("Funding has not started yet", async () => {
      await expect(
        project.connect(user1).funding(projectId, 1)
      ).to.revertedWith("Funding has not started yet");
    });

    it("Funding has ended", async () => {
      await skipBlock(300);
      await expect(
        project.connect(user1).funding(projectId, 1)
      ).to.revertedWith("Funding has ended");
    });

    it("User is not in whitelist", async () => {
      await skipBlock(100);
      await expect(
        project.connect(user2).funding(projectId, 1)
      ).to.revertedWith("User is not in whitelist");
    });

    it("Amount must be greater than min allocation", async () => {
      await skipBlock(100);
      await expect(
        project
          .connect(user1)
          .funding(projectId, new Big(fundingMinAllocation).sub(1).toString())
      ).to.revertedWith("Amount must be greater than min allocation");
    });

    it("Amount exceed max allocation", async () => {
      await skipBlock(100);
      const fundingMaxAllocation = await project.getFundingMaxAllocation(
        projectId,
        user1.address
      );
      expect(fundingMaxAllocation).to.be.equal("100000000000000000000000");
      await expect(
        project
          .connect(user1)
          .funding(projectId, fundingMaxAllocation.add(1).toString())
      ).to.revertedWith("Amount exceed max allocation");
    });

    it("Funding success", async () => {
      const fundingMaxAllocation = await project.getFundingMaxAllocation(
        projectId,
        user1.address
      );
      expect(fundingMaxAllocation).to.be.equal("100000000000000000000000");
      // fundingMaxAllocation = stakedAmount/stakedTotalAmount * allocationSize
      //                      = 10000/10000 * 100000 = 100000 USD
      const allocatedTokenAmount = await project.estimateTokenAllocation(
        projectId,
        fundingMaxAllocation
      );
      expect(allocatedTokenAmount).to.be.equal("1000000000000000000000000");
      // allocatedTokenAmount = fundingAmount / estimateTokenAllocationRate
      //                      = 100000 / 0.1 = 1000000 token

      const usdBalanceOfProject_before = await busd.balanceOf(project.address);
      const usdBalanceOfUser_before = await busd.balanceOf(user1.address);

      await skipBlock(100);
      await project.connect(user1).funding(projectId, fundingMaxAllocation);

      const busdBalanceOfProject_after = await busd.balanceOf(project.address);
      const busdBalanceOfUser_after = await busd.balanceOf(user1.address);

      expect(
        busdBalanceOfProject_after.sub(usdBalanceOfProject_before)
      ).to.be.equal(fundingMaxAllocation);
      expect(usdBalanceOfUser_before.sub(busdBalanceOfUser_after)).to.be.equal(
        fundingMaxAllocation
      );

      const fundingInfo = await project.getFundingInfo(projectId);
      expect(fundingInfo.fundedTotalAmount).to.be.equal(fundingMaxAllocation);

      const userInfo = await project.getUserInfo(projectId, user1.address);
      expect(userInfo.fundedAmount).to.be.equal(fundingMaxAllocation);
    });
  });

  describe("addUsersToWhitelist", () => {
    beforeEach(async () => {
      currentBlock = await getCurrentBlock();
      stakingStartBlockNumber = currentBlock + 100;
      stakingEndBlockNumber = stakingStartBlockNumber + 100;
      fundingStartBlockNumber = stakingEndBlockNumber + 100;
      fundingEndBlockNumber = fundingStartBlockNumber + 100;
      claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await project
        .connect(admin)
        .createProject(
          allocationSize,
          stakingStartBlockNumber,
          stakingEndBlockNumber,
          minStakeAmount,
          maxStakeAmount,
          fundingStartBlockNumber,
          fundingEndBlockNumber,
          fundingMinAllocation,
          estimateTokenAllocationRate,
          user1.address,
          claimBackStartBlockNumber,
          decimals
        );

      projectId = await project.latestProjectId();
      await skipBlock(100);

      await memberCard.mintMemberCard(user2.address, "");
      await project.connect(admin).setNftPermitted(memberCard.address, true);
      await project
        .connect(user2)
        .stakeWithNFT(projectId, memberCard.address, "0");
      await project.connect(user1).stake(projectId, maxStakeAmount);
      await skipBlock(100);
    });

    it("Only owner", async () => {
      await expect(
        project.connect(user1).addUsersToWhitelist(projectId, [user1.address])
      ).revertedWith("Not admin or owner");
      expect(await project.isAddedWhitelist(projectId, user1.address)).equal(
        false
      );
    });

    it("Account list is empty", async () => {
      await expect(
        project.connect(admin).addUsersToWhitelist(projectId, [])
      ).revertedWith("Account list is empty");
    });

    it("Invalid account", async () => {
      await expect(
        project
          .connect(admin)
          .addUsersToWhitelist(projectId, [blackHoleAddress])
      ).revertedWith("Invalid account");
    });

    it("Account did not stake yet", async () => {
      await expect(
        project.connect(admin).addUsersToWhitelist(projectId, [user3.address])
      ).revertedWith("Account did not stake yet");
      expect(await project.isAddedWhitelist(projectId, user1.address)).equal(
        false
      );
    });

    it("Success", async () => {
      expect(await project.isAddedWhitelist(projectId, user1.address)).equal(
        false
      );
      expect(await project.isAddedWhitelist(projectId, user2.address)).equal(
        true
      );
      const projectInfo_before = await project.getProjectInfo(projectId);

      await project
        .connect(admin)
        .addUsersToWhitelist(projectId, [user1.address, user2.address]);

      const projectInfo_after = await project.getProjectInfo(projectId);
      expect(projectInfo_after.whitelistedTotalPortion.toString()).to.be.equal(
        multiply(maxStakeAmount, "2")
      );
      expect(
        projectInfo_after.whitelistedTotalPortion.sub(
          projectInfo_before.whitelistedTotalPortion
        )
      ).to.be.equal(maxStakeAmount);

      expect(await project.isAddedWhitelist(projectId, user1.address)).equal(
        true
      );
    });
  });

  describe("removeUsersFromWhitelist", () => {
    beforeEach(async () => {
      currentBlock = await getCurrentBlock();
      stakingStartBlockNumber = currentBlock + 100;
      stakingEndBlockNumber = stakingStartBlockNumber + 100;
      fundingStartBlockNumber = stakingEndBlockNumber + 100;
      fundingEndBlockNumber = fundingStartBlockNumber + 100;
      claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await project
        .connect(admin)
        .createProject(
          allocationSize,
          stakingStartBlockNumber,
          stakingEndBlockNumber,
          minStakeAmount,
          maxStakeAmount,
          fundingStartBlockNumber,
          fundingEndBlockNumber,
          fundingMinAllocation,
          estimateTokenAllocationRate,
          user1.address,
          claimBackStartBlockNumber,
          decimals
        );

      projectId = await project.latestProjectId();
      await skipBlock(100);
      await project.connect(user1).stake(projectId, maxStakeAmount);
      await project.connect(user2).stake(projectId, maxStakeAmount);
      await skipBlock(100);
      await project
        .connect(admin)
        .addUsersToWhitelist(projectId, [user1.address, user2.address]);
    });

    it("Only owner", async () => {
      await expect(
        project
          .connect(user1)
          .removeUsersFromWhitelist(projectId, [user1.address])
      ).revertedWith("Not admin or owner");
    });

    it("Account list is empty", async () => {
      await expect(
        project.connect(admin).removeUsersFromWhitelist(projectId, [])
      ).revertedWith("Account list is empty");
    });

    it("Success", async () => {
      expect(await project.isAddedWhitelist(projectId, user1.address)).to.be
        .true;
      expect(await project.isAddedWhitelist(projectId, user2.address)).to.be
        .true;
      const projectInfo_before = await project.getProjectInfo(projectId);

      await project
        .connect(admin)
        .removeUsersFromWhitelist(projectId, [
          user1.address,
          user2.address,
          user3.address,
        ]);

      const projectInfo_after = await project.getProjectInfo(projectId);
      expect(
        projectInfo_before.whitelistedTotalPortion.sub(
          projectInfo_after.whitelistedTotalPortion
        )
      ).to.be.equal("20000000000000000000000");

      expect(await project.isAddedWhitelist(projectId, user1.address)).to.be
        .false;
      expect(await project.isAddedWhitelist(projectId, user2.address)).to.be
        .false;
      expect(await project.isAddedWhitelist(projectId, user3.address)).to.be
        .false;
    });
  });

  describe("claimBack", () => {
    beforeEach(async () => {
      currentBlock = await getCurrentBlock();
      stakingStartBlockNumber = currentBlock + 100;
      stakingEndBlockNumber = stakingStartBlockNumber + 100;
      fundingStartBlockNumber = stakingEndBlockNumber + 100;
      fundingEndBlockNumber = fundingStartBlockNumber + 100;
      claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await project
        .connect(admin)
        .createProject(
          allocationSize,
          stakingStartBlockNumber,
          stakingEndBlockNumber,
          minStakeAmount,
          maxStakeAmount,
          fundingStartBlockNumber,
          fundingEndBlockNumber,
          fundingMinAllocation,
          estimateTokenAllocationRate,
          user1.address,
          claimBackStartBlockNumber,
          decimals
        );

      projectId = await project.latestProjectId();
      await skipBlock(100);
      await project.connect(user1).stake(projectId, maxStakeAmount);
      await skipBlock(100);

      await project.addUsersToWhitelist(projectId, [user1.address]);

      fundingMaxAllocation = await project.getFundingMaxAllocation(
        projectId,
        user1.address
      );
      await skipBlock(100);
      await project.connect(user1).funding(projectId, fundingMaxAllocation);
      await skipBlock(190);
    });

    it("Claiming back has not started yet", async () => {
      await expect(project.connect(user1).claimBack(projectId)).to.revertedWith(
        "Claiming back has not started yet"
      );
    });

    it("Nothing to claim back", async () => {
      await skipBlock(100);
      await expect(project.connect(user2).claimBack(projectId)).to.revertedWith(
        "Nothing to claim back"
      );
    });

    it("Claim success", async () => {
      const tokenBalanceOfProject_before = await token.balanceOf(
        project.address
      );
      const tokenBalanceOfUser_before = await token.balanceOf(user1.address);

      await skipBlock(100);
      await project.connect(user1).claimBack(projectId);

      const tokenBalanceOfProject_after = await token.balanceOf(
        project.address
      );
      const tokenBalanceOfUser_after = await token.balanceOf(user1.address);

      expect(
        tokenBalanceOfProject_before.sub(tokenBalanceOfProject_after)
      ).to.be.equal(maxStakeAmount);
      expect(
        tokenBalanceOfUser_after.sub(tokenBalanceOfUser_before)
      ).to.be.equal(maxStakeAmount);

      const userInfo = await project.getUserInfo(projectId, user1.address);
      expect(userInfo.isClaimedBack).to.be.true;
    });
  });

  describe("withdrawFunding", () => {
    beforeEach(async () => {
      currentBlock = await getCurrentBlock();
      stakingStartBlockNumber = currentBlock + 100;
      stakingEndBlockNumber = stakingStartBlockNumber + 100;
      fundingStartBlockNumber = stakingEndBlockNumber + 100;
      fundingEndBlockNumber = fundingStartBlockNumber + 100;
      claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await project
        .connect(admin)
        .createProject(
          allocationSize,
          stakingStartBlockNumber,
          stakingEndBlockNumber,
          minStakeAmount,
          maxStakeAmount,
          fundingStartBlockNumber,
          fundingEndBlockNumber,
          fundingMinAllocation,
          estimateTokenAllocationRate,
          fundingReceiver.address,
          claimBackStartBlockNumber,
          decimals
        );

      projectId = await project.latestProjectId();
      await skipBlock(100);
      await project.connect(user1).stake(projectId, maxStakeAmount);
      await skipBlock(100);
      await project.addUsersToWhitelist(projectId, [user1.address]);

      fundingMaxAllocation = await project.getFundingMaxAllocation(
        projectId,
        user1.address
      );
      await skipBlock(100);
      await project.connect(user1).funding(projectId, fundingMaxAllocation);
    });

    it("Funding has not ended yet", async () => {
      await expect(
        project.connect(admin).withdrawFunding(projectId)
      ).to.revertedWith("Funding has not ended yet");
    });

    it("Already withdrawn fund", async () => {
      await skipBlock(100);
      await project.connect(admin).withdrawFunding(projectId);

      await expect(
        project.connect(admin).withdrawFunding(projectId)
      ).to.revertedWith("Already withdrawn fund");
    });

    it("Not enough amount", async () => {
      currentBlock = await getCurrentBlock();
      stakingStartBlockNumber = currentBlock + 100;
      stakingEndBlockNumber = stakingStartBlockNumber + 100;
      fundingStartBlockNumber = stakingEndBlockNumber + 100;
      fundingEndBlockNumber = fundingStartBlockNumber + 100;
      claimBackStartBlockNumber = fundingEndBlockNumber + 100;

      await project
        .connect(admin)
        .createProject(
          allocationSize,
          stakingStartBlockNumber,
          stakingEndBlockNumber,
          minStakeAmount,
          maxStakeAmount,
          fundingStartBlockNumber,
          fundingEndBlockNumber,
          fundingMinAllocation,
          estimateTokenAllocationRate,
          fundingReceiver.address,
          claimBackStartBlockNumber,
          decimals
        );

      await skipBlock(400);
      projectId = await project.latestProjectId();
      await expect(
        project.connect(admin).withdrawFunding(projectId)
      ).to.revertedWith("Nothing to withdraw");
    });

    it("Withdraw success", async () => {
      const usdBalanceOfProject_before = await busd.balanceOf(project.address);
      const usdBalanceOfFundingReceiver_before = await busd.balanceOf(
        fundingReceiver.address
      );

      await skipBlock(300);
      await project.connect(admin).setAdmin(user1.address, true);
      await project.connect(user1).withdrawFunding(projectId);

      const usdBalanceOfProject_after = await busd.balanceOf(project.address);
      const usdBalanceOffundingReceiver_after = await busd.balanceOf(
        fundingReceiver.address
      );

      expect(
        usdBalanceOfProject_before.sub(usdBalanceOfProject_after)
      ).to.be.equal(fundingMaxAllocation);
      expect(
        usdBalanceOffundingReceiver_after.sub(
          usdBalanceOfFundingReceiver_before
        )
      ).to.be.equal(fundingMaxAllocation);

      const fundingInfo = await project.getFundingInfo(projectId);
      expect(fundingInfo.isWithdrawnFund).to.be.true;
    });
  });
});
