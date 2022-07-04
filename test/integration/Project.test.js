const { ethers } = require("hardhat");
const { expect } = require("chai");
const { getCurrentBlock, skipBlock } = require("../utils");
const { MaxUint256 } = require("@ethersproject/constants");

describe("Project - Integration", () => {
  before(async () => {
    const accounts = await ethers.getSigners();
    admin = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    user3 = accounts[3];
    user4 = accounts[4];
    user5 = accounts[5];
    user6 = accounts[6];
    fundingReceiver = accounts[10];

    const TokenGMI = await ethers.getContractFactory("TokenGMI");
    token = await TokenGMI.deploy();

    const CashTestToken = await ethers.getContractFactory("CashTestToken");
    busd = await CashTestToken.deploy([admin.address, user1.address, user2.address, user3.address, user4.address, user5.address]);

    const MemberCard = await ethers.getContractFactory("MemberCard");
    memberCard = await MemberCard.deploy();
    await memberCard.initialize(admin.address, "NFT", "NFT");

    const Project = await ethers.getContractFactory("Project");
    project = await upgrades.deployProxy(Project, [admin.address, token.address, busd.address]);

    await project.setNftPermitted(memberCard.address, true);

    await token.addController(admin.address);
    await token.mint(user1.address, '1000000000000000000000000'); // mint 1000,000 token GMI
    await token.mint(user2.address, '1000000000000000000000000'); // mint 1000,000 token GMI
    await token.mint(user3.address, '1000000000000000000000000'); // mint 1000,000 token GMI
    await token.mint(user4.address, '1000000000000000000000000'); // mint 1000,000 token GMI
    await token.mint(user5.address, '1000000000000000000000'); // mint 1000 token GMI

    await token.connect(user1).approve(project.address, MaxUint256.toString());
    await token.connect(user2).approve(project.address, MaxUint256.toString());
    await token.connect(user3).approve(project.address, MaxUint256.toString());
    await token.connect(user4).approve(project.address, MaxUint256.toString());

    await busd.connect(user1).approve(project.address, MaxUint256.toString());
    await busd.connect(user3).approve(project.address, MaxUint256.toString());
    await busd.connect(user4).approve(project.address, MaxUint256.toString());
    await busd.connect(user5).approve(project.address, MaxUint256.toString());

    await memberCard.setVendor(project.address, true);
    await memberCard.mintMemberCard(user5.address, "");  

    allocationSize = '100000000000000000000000'; // 100,000 USD
    minStakeAmount = '1000000000000000000000';    // 1000 GMI
    maxStakeAmount = '10000000000000000000000';   // 10000 GMI
    fundingMinAllocation = '10000000000000000000';     // 10 USD
    estimateTokenAllocationRate = '100000000000000000'; // rate is 0.1 / mean that fund 1 USD => receive 1 / 0.1 = 10 token

    decimals = await token.decimals();
  });

  it("Create project", async () => {
    expect(await project.latestProjectId()).equal(0, "Invalid project id");
    let currentBlock = await getCurrentBlock();
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
    expect(projectId).equal(1, "Invalid project id");

    const projectInfo = await project.getProjectInfo(projectId);
    expect(projectInfo.id).to.equal(1);
    expect(projectInfo.allocationSize).to.equal(allocationSize);
    expect(projectInfo.stakeInfo.startBlockNumber).to.equal(stakingStartBlockNumber);
    expect(projectInfo.stakeInfo.endBlockNumber).to.equal(stakingEndBlockNumber);
    expect(projectInfo.stakeInfo.minStakeAmount).to.equal(minStakeAmount);
    expect(projectInfo.stakeInfo.maxStakeAmount).to.equal(maxStakeAmount);
    expect(projectInfo.stakeInfo.stakedTotalAmount).to.equal(0);
    expect(projectInfo.whitelistedTotalPortion).to.equal(0);
    expect(projectInfo.fundingInfo.startBlockNumber).to.equal(fundingStartBlockNumber);
    expect(projectInfo.fundingInfo.endBlockNumber).to.equal(fundingEndBlockNumber);
    expect(projectInfo.fundingInfo.minAllocation).to.equal(fundingMinAllocation);
    expect(projectInfo.fundingInfo.estimateTokenAllocationRate).to.equal(estimateTokenAllocationRate);
    expect(projectInfo.fundingInfo.fundedTotalAmount).to.equal(0);
    expect(projectInfo.fundingInfo.fundingReceiver).to.equal(fundingReceiver.address);
    expect(projectInfo.fundingInfo.isWithdrawnFund).to.be.false;
    expect(projectInfo.claimBackInfo.startBlockNumber).to.equal(claimBackStartBlockNumber);
  });

  it("User 1, 2, 3, 4, 5 stake", async () => {
    await skipBlock(100);

    const user1TokenBalance_before = await token.balanceOf(user1.address);
    const user2TokenBalance_before = await token.balanceOf(user2.address);
    const user3TokenBalance_before = await token.balanceOf(user3.address);
    const user4TokenBalance_before = await token.balanceOf(user4.address);
    const projectTokenBalance_before = await token.balanceOf(project.address);
    const memberCardCounter_before = await memberCard.getMemberCardCounter(0);

    await project.connect(user1).stake(projectId, '1000000000000000000000');  // 1000 token GMI
    await project.connect(user2).stake(projectId, '2000000000000000000000'); // 2000 token GMI
    await project.connect(user3).stake(projectId, '6000000000000000000000'); // 6000 token GMI
    await project.connect(user4).stake(projectId, '10000000000000000000000'); // 10000 token GMI
    await project.connect(user5).stakeWithNFT(projectId, memberCard.address, 0);

    const user1TokenBalance_after = await token.balanceOf(user1.address);
    const user2TokenBalance_after = await token.balanceOf(user2.address);
    const user3TokenBalance_after = await token.balanceOf(user3.address);
    const user4TokenBalance_after = await token.balanceOf(user4.address);
    const projectTokenBalance_after = await token.balanceOf(project.address);
    const memberCardCounter_after = await memberCard.getMemberCardCounter(0);

    expect(user1TokenBalance_before.sub(user1TokenBalance_after)).to.equal('1000000000000000000000');
    expect(user2TokenBalance_before.sub(user2TokenBalance_after)).to.equal('2000000000000000000000');
    expect(user3TokenBalance_before.sub(user3TokenBalance_after)).to.equal('6000000000000000000000');
    expect(user4TokenBalance_before.sub(user4TokenBalance_after)).to.equal('10000000000000000000000');
    expect(projectTokenBalance_after.sub(projectTokenBalance_before)).to.equal('19000000000000000000000');
    expect(memberCardCounter_before.sub(memberCardCounter_after)).to.equal('1');

    const user1Info = await project.getUserInfo(projectId, user1.address);
    expect(user1Info.isClaimedBack).to.be.false;
    expect(user1Info.usedNft).to.equal('0');
    expect(user1Info.stakedAmount).to.equal('1000000000000000000000');
    expect(user1Info.allocatedPortion).to.equal('1000000000000000000000');
    expect(user1Info.fundedAmount).to.equal('0');
    expect(user1Info.tokenAllocationAmount).to.equal('0');

    const user2Info = await project.getUserInfo(projectId, user2.address);
    expect(user2Info.isClaimedBack).to.be.false;
    expect(user2Info.usedNft).to.equal('0');
    expect(user2Info.stakedAmount).to.equal('2000000000000000000000');
    expect(user2Info.allocatedPortion).to.equal('2000000000000000000000');
    expect(user2Info.fundedAmount).to.equal('0');
    expect(user2Info.tokenAllocationAmount).to.equal('0');

    const user3Info = await project.getUserInfo(projectId, user3.address);
    expect(user3Info.isClaimedBack).to.be.false;
    expect(user3Info.usedNft).to.equal('0');
    expect(user3Info.stakedAmount).to.equal('6000000000000000000000');
    expect(user3Info.allocatedPortion).to.equal('6000000000000000000000');
    expect(user3Info.fundedAmount).to.equal('0');
    expect(user3Info.tokenAllocationAmount).to.equal('0');

    const user4Info = await project.getUserInfo(projectId, user4.address);
    expect(user4Info.isClaimedBack).to.be.false;
    expect(user4Info.usedNft).to.equal('0');
    expect(user4Info.stakedAmount).to.equal('10000000000000000000000');
    expect(user4Info.allocatedPortion).to.equal('10000000000000000000000');
    expect(user4Info.fundedAmount).to.equal('0');
    expect(user4Info.tokenAllocationAmount).to.equal('0');

    const user5Info = await project.getUserInfo(projectId, user5.address);
    expect(user5Info.isClaimedBack).to.be.false;
    expect(user5Info.usedNft).to.equal('1');
    expect(user5Info.stakedAmount).to.equal('0');
    expect(user5Info.allocatedPortion).to.equal('10000000000000000000000');
    expect(user5Info.fundedAmount).to.equal('0');
    expect(user5Info.tokenAllocationAmount).to.equal('0');

    const projectInfo = await project.getProjectInfo(projectId);
    expect(projectInfo.stakeInfo.stakedTotalAmount).to.equal('19000000000000000000000');
    expect(projectInfo.whitelistedTotalPortion).to.equal('10000000000000000000000');
    expect(projectInfo.fundingInfo.fundedTotalAmount).to.equal(0);
    expect(projectInfo.fundingInfo.isWithdrawnFund).to.be.false;

    expect(await project.isAddedWhitelist(projectId, user1.address)).to.be.false;
    expect(await project.isAddedWhitelist(projectId, user2.address)).to.be.false;
    expect(await project.isAddedWhitelist(projectId, user3.address)).to.be.false;
    expect(await project.isAddedWhitelist(projectId, user4.address)).to.be.false;
    expect(await project.isAddedWhitelist(projectId, user5.address)).to.be.true;

    await skipBlock(100);
  });

  it("Add user 1, 2, 3, 4 to whitelist", async () => {
    await project.connect(admin).addUsersToWhitelist(projectId, [
      user1.address,
      user2.address,
      user3.address,
      user4.address
    ]);

    const projectInfo = await project.getProjectInfo(projectId);
    expect(projectInfo.whitelistedTotalPortion).to.equal('29000000000000000000000');

    expect(await project.isAddedWhitelist(projectId, user1.address)).to.be.true;
    expect(await project.isAddedWhitelist(projectId, user2.address)).to.be.true;
    expect(await project.isAddedWhitelist(projectId, user3.address)).to.be.true;
    expect(await project.isAddedWhitelist(projectId, user4.address)).to.be.true;
    expect(await project.isAddedWhitelist(projectId, user5.address)).to.be.true;
  });

  it("Remove user 2 out of whitelist", async () => {
    await project.connect(admin).removeUsersFromWhitelist(projectId, [
      user2.address,
    ]);

    const projectInfo = await project.getProjectInfo(projectId);
    expect(projectInfo.whitelistedTotalPortion).to.equal('27000000000000000000000');

    expect(await project.isAddedWhitelist(projectId, user1.address)).to.be.true;
    expect(await project.isAddedWhitelist(projectId, user2.address)).to.be.false;
    expect(await project.isAddedWhitelist(projectId, user3.address)).to.be.true;
    expect(await project.isAddedWhitelist(projectId, user4.address)).to.be.true;
    expect(await project.isAddedWhitelist(projectId, user5.address)).to.be.true;
  });

  it("User 1 funding all allocation portion", async () => {
    fundingMaxAllocation_user1 = await project.getFundingMaxAllocation(projectId, user1.address);
    fundingMaxAllocation_user2 = await project.getFundingMaxAllocation(projectId, user2.address);
    fundingMaxAllocation_user3 = await project.getFundingMaxAllocation(projectId, user3.address);
    fundingMaxAllocation_user4 = await project.getFundingMaxAllocation(projectId, user4.address);
    fundingMaxAllocation_user5 = await project.getFundingMaxAllocation(projectId, user5.address);

    expect(fundingMaxAllocation_user2).to.equal('0');

    expect(fundingMaxAllocation_user1).to.equal('3703703703703703703703');
    // (1000 / (1000 + 6000 + 10000 + 10000)) * 100,000 = 3703.703703703703703703 USD

    expect(fundingMaxAllocation_user3).to.equal('22222222222222222222222');
    // (6000 / (1000 + 6000 + 10000 + 10000)) * 100,000 = 22222.222222222222222222 USD

    expect(fundingMaxAllocation_user4).to.equal('37037037037037037037037');
    // (10000 / (1000 + 6000 + 10000 + 10000)) * 100,000 = 37037.03703703703703703 USD

    expect(fundingMaxAllocation_user5).to.equal('37037037037037037037037');
    // (10000 / (1000 + 6000 + 10000 + 10000)) * 100,000 = 37037.03703703703703703 USD

    const totalallocatedPortion = fundingMaxAllocation_user1.add(fundingMaxAllocation_user3).add(fundingMaxAllocation_user4).add(fundingMaxAllocation_user5);
    expect(totalallocatedPortion).to.equal('99999999999999999999999');
    // 100.000 => number error: 1

    await skipBlock(100);

    const user1_BusdBalance_before = await busd.balanceOf(user1.address);
    const project_BusdBalance_before = await busd.balanceOf(project.address);

    await project.connect(user1).funding(projectId, fundingMaxAllocation_user1);

    const user1_BusdBalance_after = await busd.balanceOf(user1.address);
    const project_BusdBalance_after = await busd.balanceOf(project.address);

    expect(user1_BusdBalance_before.sub(user1_BusdBalance_after)).to.equal(fundingMaxAllocation_user1);
    expect(project_BusdBalance_after.sub(project_BusdBalance_before)).to.equal(fundingMaxAllocation_user1);

    const user1Info = await project.getUserInfo(projectId, user1.address);
    expect(user1Info.isClaimedBack).to.be.false;
    expect(user1Info.usedNft).to.equal('0');
    expect(user1Info.stakedAmount).to.equal('1000000000000000000000');
    expect(user1Info.allocatedPortion).to.equal('1000000000000000000000');
    expect(user1Info.fundedAmount).to.equal(fundingMaxAllocation_user1);
    expect(user1Info.tokenAllocationAmount).to.equal(fundingMaxAllocation_user1.mul(10)); // div(0.1) <=> mul(10)

    fundedTotalAmount_expect = fundingMaxAllocation_user1;
    const projectInfo = await project.getProjectInfo(projectId);
    expect(projectInfo.fundingInfo.fundedTotalAmount).to.equal(fundedTotalAmount_expect);

    const fundingMaxAllocation_user1_after = await project.getFundingMaxAllocation(projectId, user1.address);
    expect(fundingMaxAllocation_user1_after).to.equal('0');

    await expect(
      project.connect(user1).funding(projectId, fundingMinAllocation)
    ).revertedWith("Amount exceed max allocation");
  });

  it("User 3 funding all allocation portion", async () => {
    const user3_BusdBalance_before = await busd.balanceOf(user3.address);
    const project_BusdBalance_before = await busd.balanceOf(project.address);

    await project.connect(user3).funding(projectId, fundingMaxAllocation_user3);

    const user3_BusdBalance_after = await busd.balanceOf(user3.address);
    const project_BusdBalance_after = await busd.balanceOf(project.address);

    expect(user3_BusdBalance_before.sub(user3_BusdBalance_after)).to.equal(fundingMaxAllocation_user3);
    expect(project_BusdBalance_after.sub(project_BusdBalance_before)).to.equal(fundingMaxAllocation_user3);

    const user3Info = await project.getUserInfo(projectId, user3.address);
    expect(user3Info.isClaimedBack).to.be.false;
    expect(user3Info.usedNft).to.equal('0');
    expect(user3Info.stakedAmount).to.equal('6000000000000000000000');
    expect(user3Info.allocatedPortion).to.equal('6000000000000000000000');
    expect(user3Info.fundedAmount).to.equal(fundingMaxAllocation_user3);
    expect(user3Info.tokenAllocationAmount).to.equal(fundingMaxAllocation_user3.mul(10)); // div(0.1) <=> mul(10)

    fundedTotalAmount_expect = fundedTotalAmount_expect.add(fundingMaxAllocation_user3);
    const projectInfo = await project.getProjectInfo(projectId);
    expect(projectInfo.fundingInfo.fundedTotalAmount).to.equal(fundedTotalAmount_expect);

    const fundingMaxAllocation_user3_after = await project.getFundingMaxAllocation(projectId, user3.address);
    expect(fundingMaxAllocation_user3_after).to.equal('0');

    await expect(
      project.connect(user3).funding(projectId, fundingMinAllocation)
    ).revertedWith("Amount exceed max allocation");
  });

  it("User 4 funding a part of allocation portion", async () => {
    const user4_BusdBalance_before = await busd.balanceOf(user4.address);
    const project_BusdBalance_before = await busd.balanceOf(project.address);

    await project.connect(user4).funding(projectId, '10000000000000000000000'); // 10,000 USD

    const user4_BusdBalance_after = await busd.balanceOf(user4.address);
    const project_BusdBalance_after = await busd.balanceOf(project.address);

    expect(user4_BusdBalance_before.sub(user4_BusdBalance_after)).to.equal('10000000000000000000000');
    expect(project_BusdBalance_after.sub(project_BusdBalance_before)).to.equal('10000000000000000000000');

    const user4Info = await project.getUserInfo(projectId, user4.address);
    expect(user4Info.isClaimedBack).to.be.false;
    expect(user4Info.usedNft).to.equal('0');
    expect(user4Info.stakedAmount).to.equal('10000000000000000000000');
    expect(user4Info.allocatedPortion).to.equal('10000000000000000000000');
    expect(user4Info.fundedAmount).to.equal('10000000000000000000000');
    expect(user4Info.tokenAllocationAmount).to.equal('100000000000000000000000'); // 10k div(0.1) <=> 10k mul(10) = 100k

    fundedTotalAmount_expect = fundedTotalAmount_expect.add('10000000000000000000000');
    const projectInfo = await project.getProjectInfo(projectId);
    expect(projectInfo.fundingInfo.fundedTotalAmount).to.equal(fundedTotalAmount_expect);

    const fundingMaxAllocation_user4_after = await project.getFundingMaxAllocation(projectId, user4.address);
    expect(fundingMaxAllocation_user4_after).to.equal(fundingMaxAllocation_user4.sub('10000000000000000000000'));
  });

  it("User 4 funding remaining of allocation portion", async () => {
    const user4_BusdBalance_before = await busd.balanceOf(user4.address);
    const project_BusdBalance_before = await busd.balanceOf(project.address);

    const remainingAllocation = await project.getFundingMaxAllocation(projectId, user4.address);
    await project.connect(user4).funding(projectId, remainingAllocation); // 37037.03703703703703703 - 10,000 = 27037.03703703703703703 USD

    const user4_BusdBalance_after = await busd.balanceOf(user4.address);
    const project_BusdBalance_after = await busd.balanceOf(project.address);

    expect(user4_BusdBalance_before.sub(user4_BusdBalance_after)).to.equal(remainingAllocation);
    expect(project_BusdBalance_after.sub(project_BusdBalance_before)).to.equal(remainingAllocation);

    const user4Info = await project.getUserInfo(projectId, user4.address);
    expect(user4Info.isClaimedBack).to.be.false;
    expect(user4Info.usedNft).to.equal('0');
    expect(user4Info.stakedAmount).to.equal('10000000000000000000000');
    expect(user4Info.allocatedPortion).to.equal('10000000000000000000000');
    expect(user4Info.fundedAmount).to.equal(fundingMaxAllocation_user4);
    expect(user4Info.tokenAllocationAmount).to.equal(fundingMaxAllocation_user4.mul(10)); // 10k div(0.1) <=> 10k mul(10) = 100k

    fundedTotalAmount_expect = fundedTotalAmount_expect.add(remainingAllocation);
    const projectInfo = await project.getProjectInfo(projectId);
    expect(projectInfo.fundingInfo.fundedTotalAmount).to.equal(fundedTotalAmount_expect);

    const fundingMaxAllocation_user4_after = await project.getFundingMaxAllocation(projectId, user4.address);
    expect(fundingMaxAllocation_user4_after).to.equal('0');

    await expect(
      project.connect(user4).funding(projectId, fundingMinAllocation)
    ).revertedWith("Amount exceed max allocation");
  });

  it("User 5 funding all allocation portion", async () => {
    const user5_BusdBalance_before = await busd.balanceOf(user5.address);
    const project_BusdBalance_before = await busd.balanceOf(project.address);

    await project.connect(user5).funding(projectId, fundingMaxAllocation_user5);

    const user5_BusdBalance_after = await busd.balanceOf(user5.address);
    const project_BusdBalance_after = await busd.balanceOf(project.address);

    expect(user5_BusdBalance_before.sub(user5_BusdBalance_after)).to.equal(fundingMaxAllocation_user5);
    expect(project_BusdBalance_after.sub(project_BusdBalance_before)).to.equal(fundingMaxAllocation_user5);

    const user5Info = await project.getUserInfo(projectId, user5.address);
    expect(user5Info.isClaimedBack).to.be.false;
    expect(user5Info.usedNft).to.equal('1');
    expect(user5Info.stakedAmount).to.equal('0');
    expect(user5Info.allocatedPortion).to.equal('10000000000000000000000');
    expect(user5Info.fundedAmount).to.equal(fundingMaxAllocation_user5);
    expect(user5Info.tokenAllocationAmount).to.equal(fundingMaxAllocation_user5.mul(10)); // div(0.1) <=> mul(10)

    fundedTotalAmount_expect = fundedTotalAmount_expect.add(fundingMaxAllocation_user5);
    const projectInfo = await project.getProjectInfo(projectId);
    expect(projectInfo.fundingInfo.fundedTotalAmount).to.equal(fundedTotalAmount_expect);

    const fundingMaxAllocation_user5_after = await project.getFundingMaxAllocation(projectId, user5.address);
    expect(fundingMaxAllocation_user5_after).to.equal('0');

    await expect(
      project.connect(user5).funding(projectId, fundingMinAllocation)
    ).revertedWith("Amount exceed max allocation");
  });

  it("User 1, 2, 3, 4, 5 claim back GMI", async () => {
    await skipBlock(200);

    const user1TokenBalance_before = await token.balanceOf(user1.address);
    const user2TokenBalance_before = await token.balanceOf(user2.address);
    const user3TokenBalance_before = await token.balanceOf(user3.address);
    const user4TokenBalance_before = await token.balanceOf(user4.address);
    const user5TokenBalance_before = await token.balanceOf(user5.address);
    const projectTokenBalance_before = await token.balanceOf(project.address);

    await project.connect(user1).claimBack(projectId);
    await project.connect(user2).claimBack(projectId);
    await project.connect(user3).claimBack(projectId);
    await project.connect(user4).claimBack(projectId);
    await expect(
      project.connect(user5).claimBack(projectId)
    ).revertedWith("Nothing to claim back");

    const user1TokenBalance_after = await token.balanceOf(user1.address);
    const user2TokenBalance_after = await token.balanceOf(user2.address);
    const user3TokenBalance_after = await token.balanceOf(user3.address);
    const user4TokenBalance_after = await token.balanceOf(user4.address);
    const user5TokenBalance_after = await token.balanceOf(user5.address);
    const projectTokenBalance_after = await token.balanceOf(project.address);

    expect(user1TokenBalance_after.sub(user1TokenBalance_before)).to.equal('1000000000000000000000');
    expect(user2TokenBalance_after.sub(user2TokenBalance_before)).to.equal('2000000000000000000000');
    expect(user3TokenBalance_after.sub(user3TokenBalance_before)).to.equal('6000000000000000000000');
    expect(user4TokenBalance_after.sub(user4TokenBalance_before)).to.equal('10000000000000000000000');
    expect(user5TokenBalance_after.sub(user5TokenBalance_before)).to.equal('0');
    expect(projectTokenBalance_before.sub(projectTokenBalance_after)).to.equal('19000000000000000000000');
    expect(projectTokenBalance_after).to.equal('0');

    const user1Info = await project.getUserInfo(projectId, user1.address);
    const user2Info = await project.getUserInfo(projectId, user2.address);
    const user3Info = await project.getUserInfo(projectId, user3.address);
    const user4Info = await project.getUserInfo(projectId, user4.address);
    const user5Info = await project.getUserInfo(projectId, user5.address);

    expect(user1Info.isClaimedBack).to.be.true;
    expect(user2Info.isClaimedBack).to.be.true;
    expect(user3Info.isClaimedBack).to.be.true;
    expect(user4Info.isClaimedBack).to.be.true;
    expect(user5Info.isClaimedBack).to.be.false;
  });

  it("Admin send funded BUSD to funding receiver", async () => {
    const fundingReceiver_BusdBalance_before = await busd.balanceOf(fundingReceiver.address);
    const project_BusdBalance_before = await busd.balanceOf(project.address);

    await project.connect(admin).withdrawFunding(projectId);

    const fundingReceiver_BusdBalance_after = await busd.balanceOf(fundingReceiver.address);
    const project_BusdBalance_after = await busd.balanceOf(project.address);

    expect(project_BusdBalance_after).to.equal('0');
    expect(project_BusdBalance_before.sub(project_BusdBalance_after)).to.equal('99999999999999999999999');
    expect(fundingReceiver_BusdBalance_after.sub(fundingReceiver_BusdBalance_before)).to.equal('99999999999999999999999');

    const projectInfo = await project.getProjectInfo(projectId);
    expect(projectInfo.id).to.equal(1);
    expect(projectInfo.allocationSize).to.equal(allocationSize);
    expect(projectInfo.totalTokenAllocated).to.equal('999999999999999999999990');
    expect(projectInfo.stakeInfo.startBlockNumber).to.equal(stakingStartBlockNumber);
    expect(projectInfo.stakeInfo.endBlockNumber).to.equal(stakingEndBlockNumber);
    expect(projectInfo.stakeInfo.minStakeAmount).to.equal(minStakeAmount);
    expect(projectInfo.stakeInfo.maxStakeAmount).to.equal(maxStakeAmount);
    expect(projectInfo.stakeInfo.stakedTotalAmount).to.equal('19000000000000000000000');
    expect(projectInfo.whitelistedTotalPortion).to.equal('27000000000000000000000');
    expect(projectInfo.fundingInfo.startBlockNumber).to.equal(fundingStartBlockNumber);
    expect(projectInfo.fundingInfo.endBlockNumber).to.equal(fundingEndBlockNumber);
    expect(projectInfo.fundingInfo.minAllocation).to.equal(fundingMinAllocation);
    expect(projectInfo.fundingInfo.estimateTokenAllocationRate).to.equal(estimateTokenAllocationRate);
    expect(projectInfo.fundingInfo.fundedTotalAmount).to.equal('99999999999999999999999');
    expect(projectInfo.fundingInfo.fundingReceiver).to.equal(fundingReceiver.address);
    expect(projectInfo.fundingInfo.isWithdrawnFund).to.be.true;
    expect(projectInfo.claimBackInfo.startBlockNumber).to.equal(claimBackStartBlockNumber);
  });

  it("Create project", async () => {
    expect(await project.latestProjectId()).equal(1, "Invalid project id");
    let currentBlock = await getCurrentBlock();
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
    expect(projectId).equal(2, "Invalid project id");

    const projectInfo = await project.getProjectInfo(projectId);
    expect(projectInfo.id).to.equal(2);
    expect(projectInfo.allocationSize).to.equal(allocationSize);
    expect(projectInfo.stakeInfo.startBlockNumber).to.equal(stakingStartBlockNumber);
    expect(projectInfo.stakeInfo.endBlockNumber).to.equal(stakingEndBlockNumber);
    expect(projectInfo.stakeInfo.minStakeAmount).to.equal(minStakeAmount);
    expect(projectInfo.stakeInfo.maxStakeAmount).to.equal(maxStakeAmount);
    expect(projectInfo.stakeInfo.stakedTotalAmount).to.equal(0);
    expect(projectInfo.whitelistedTotalPortion).to.equal(0);
    expect(projectInfo.fundingInfo.startBlockNumber).to.equal(fundingStartBlockNumber);
    expect(projectInfo.fundingInfo.endBlockNumber).to.equal(fundingEndBlockNumber);
    expect(projectInfo.fundingInfo.minAllocation).to.equal(fundingMinAllocation);
    expect(projectInfo.fundingInfo.estimateTokenAllocationRate).to.equal(estimateTokenAllocationRate);
    expect(projectInfo.fundingInfo.fundedTotalAmount).to.equal(0);
    expect(projectInfo.fundingInfo.fundingReceiver).to.equal(fundingReceiver.address);
    expect(projectInfo.fundingInfo.isWithdrawnFund).to.be.false;
    expect(projectInfo.claimBackInfo.startBlockNumber).to.equal(claimBackStartBlockNumber);
  });

  it("User 1, 2, 3, 4, 5 stake", async () => {
    await skipBlock(100);

    const user1TokenBalance_before = await token.balanceOf(user1.address);
    const user2TokenBalance_before = await token.balanceOf(user2.address);
    const user3TokenBalance_before = await token.balanceOf(user3.address);
    const user4TokenBalance_before = await token.balanceOf(user4.address);
    const projectTokenBalance_before = await token.balanceOf(project.address);
    const memberCardCounter_before = await memberCard.getMemberCardCounter(0);

    await project.connect(user1).stake(projectId, '1000000000000000000000');  // 1000 token GMI
    await project.connect(user2).stake(projectId, '2000000000000000000000'); // 2000 token GMI
    await project.connect(user3).stake(projectId, '6000000000000000000000'); // 6000 token GMI
    await project.connect(user4).stake(projectId, '10000000000000000000000'); // 10000 token GMI
    await project.connect(user5).stakeWithNFT(projectId, memberCard.address, 0);

    const user1TokenBalance_after = await token.balanceOf(user1.address);
    const user2TokenBalance_after = await token.balanceOf(user2.address);
    const user3TokenBalance_after = await token.balanceOf(user3.address);
    const user4TokenBalance_after = await token.balanceOf(user4.address);
    const projectTokenBalance_after = await token.balanceOf(project.address);
    const memberCardCounter_after = await memberCard.getMemberCardCounter(0);

    expect(user1TokenBalance_before.sub(user1TokenBalance_after)).to.equal('1000000000000000000000');
    expect(user2TokenBalance_before.sub(user2TokenBalance_after)).to.equal('2000000000000000000000');
    expect(user3TokenBalance_before.sub(user3TokenBalance_after)).to.equal('6000000000000000000000');
    expect(user4TokenBalance_before.sub(user4TokenBalance_after)).to.equal('10000000000000000000000');
    expect(projectTokenBalance_after.sub(projectTokenBalance_before)).to.equal('19000000000000000000000');
    expect(memberCardCounter_before.sub(memberCardCounter_after)).to.equal('1');

    const user1Info = await project.getUserInfo(projectId, user1.address);
    expect(user1Info.isClaimedBack).to.be.false;
    expect(user1Info.usedNft).to.equal('0');
    expect(user1Info.stakedAmount).to.equal('1000000000000000000000');
    expect(user1Info.allocatedPortion).to.equal('1000000000000000000000');
    expect(user1Info.fundedAmount).to.equal('0');
    expect(user1Info.tokenAllocationAmount).to.equal('0');

    const user2Info = await project.getUserInfo(projectId, user2.address);
    expect(user2Info.isClaimedBack).to.be.false;
    expect(user2Info.usedNft).to.equal('0');
    expect(user2Info.stakedAmount).to.equal('2000000000000000000000');
    expect(user2Info.allocatedPortion).to.equal('2000000000000000000000');
    expect(user2Info.fundedAmount).to.equal('0');
    expect(user2Info.tokenAllocationAmount).to.equal('0');

    const user3Info = await project.getUserInfo(projectId, user3.address);
    expect(user3Info.isClaimedBack).to.be.false;
    expect(user3Info.usedNft).to.equal('0');
    expect(user3Info.stakedAmount).to.equal('6000000000000000000000');
    expect(user3Info.allocatedPortion).to.equal('6000000000000000000000');
    expect(user3Info.fundedAmount).to.equal('0');
    expect(user3Info.tokenAllocationAmount).to.equal('0');

    const user4Info = await project.getUserInfo(projectId, user4.address);
    expect(user4Info.isClaimedBack).to.be.false;
    expect(user4Info.usedNft).to.equal('0');
    expect(user4Info.stakedAmount).to.equal('10000000000000000000000');
    expect(user4Info.allocatedPortion).to.equal('10000000000000000000000');
    expect(user4Info.fundedAmount).to.equal('0');
    expect(user4Info.tokenAllocationAmount).to.equal('0');

    const user5Info = await project.getUserInfo(projectId, user5.address);
    expect(user5Info.isClaimedBack).to.be.false;
    expect(user5Info.usedNft).to.equal('1');
    expect(user5Info.stakedAmount).to.equal('0');
    expect(user5Info.allocatedPortion).to.equal('10000000000000000000000');
    expect(user5Info.fundedAmount).to.equal('0');
    expect(user5Info.tokenAllocationAmount).to.equal('0');

    const projectInfo = await project.getProjectInfo(projectId);
    expect(projectInfo.stakeInfo.stakedTotalAmount).to.equal('19000000000000000000000');
    expect(projectInfo.whitelistedTotalPortion).to.equal('10000000000000000000000');
    expect(projectInfo.fundingInfo.fundedTotalAmount).to.equal(0);
    expect(projectInfo.fundingInfo.isWithdrawnFund).to.be.false;

    expect(await project.isAddedWhitelist(projectId, user1.address)).to.be.false;
    expect(await project.isAddedWhitelist(projectId, user2.address)).to.be.false;
    expect(await project.isAddedWhitelist(projectId, user3.address)).to.be.false;
    expect(await project.isAddedWhitelist(projectId, user4.address)).to.be.false;
    expect(await project.isAddedWhitelist(projectId, user5.address)).to.be.true;

    await skipBlock(100);
  });

  it("Add user 1, 2, 3, 4 to whitelist", async () => {
    await project.connect(admin).addUsersToWhitelist(projectId, [
      user1.address,
      user2.address,
      user3.address,
      user4.address
    ]);

    const projectInfo = await project.getProjectInfo(projectId);
    expect(projectInfo.whitelistedTotalPortion).to.equal('29000000000000000000000');

    expect(await project.isAddedWhitelist(projectId, user1.address)).to.be.true;
    expect(await project.isAddedWhitelist(projectId, user2.address)).to.be.true;
    expect(await project.isAddedWhitelist(projectId, user3.address)).to.be.true;
    expect(await project.isAddedWhitelist(projectId, user4.address)).to.be.true;
    expect(await project.isAddedWhitelist(projectId, user5.address)).to.be.true;
  });

  it("Remove user 2 out of whitelist", async () => {
    await project.connect(admin).removeUsersFromWhitelist(projectId, [
      user2.address,
    ]);

    const projectInfo = await project.getProjectInfo(projectId);
    expect(projectInfo.whitelistedTotalPortion).to.equal('27000000000000000000000');

    expect(await project.isAddedWhitelist(projectId, user1.address)).to.be.true;
    expect(await project.isAddedWhitelist(projectId, user2.address)).to.be.false;
    expect(await project.isAddedWhitelist(projectId, user3.address)).to.be.true;
    expect(await project.isAddedWhitelist(projectId, user4.address)).to.be.true;
    expect(await project.isAddedWhitelist(projectId, user5.address)).to.be.true;
  });

  it("User 1 funding all allocation portion", async () => {
    fundingMaxAllocation_user1 = await project.getFundingMaxAllocation(projectId, user1.address);
    fundingMaxAllocation_user2 = await project.getFundingMaxAllocation(projectId, user2.address);
    fundingMaxAllocation_user3 = await project.getFundingMaxAllocation(projectId, user3.address);
    fundingMaxAllocation_user4 = await project.getFundingMaxAllocation(projectId, user4.address);
    fundingMaxAllocation_user5 = await project.getFundingMaxAllocation(projectId, user5.address);

    expect(fundingMaxAllocation_user2).to.equal('0');

    expect(fundingMaxAllocation_user1).to.equal('3703703703703703703703');
    // (1000 / (1000 + 6000 + 10000 + 10000)) * 100,000 = 3703.703703703703703703 USD

    expect(fundingMaxAllocation_user3).to.equal('22222222222222222222222');
    // (6000 / (1000 + 6000 + 10000 + 10000)) * 100,000 = 22222.222222222222222222 USD

    expect(fundingMaxAllocation_user4).to.equal('37037037037037037037037');
    // (10000 / (1000 + 6000 + 10000 + 10000)) * 100,000 = 37037.03703703703703703 USD

    expect(fundingMaxAllocation_user5).to.equal('37037037037037037037037');
    // (10000 / (1000 + 6000 + 10000 + 10000)) * 100,000 = 37037.03703703703703703 USD

    const totalallocatedPortion = fundingMaxAllocation_user1.add(fundingMaxAllocation_user3).add(fundingMaxAllocation_user4).add(fundingMaxAllocation_user5);
    expect(totalallocatedPortion).to.equal('99999999999999999999999');
    // 100.000 => number error: 1

    await skipBlock(100);

    const user1_BusdBalance_before = await busd.balanceOf(user1.address);
    const project_BusdBalance_before = await busd.balanceOf(project.address);

    await project.connect(user1).funding(projectId, fundingMaxAllocation_user1);

    const user1_BusdBalance_after = await busd.balanceOf(user1.address);
    const project_BusdBalance_after = await busd.balanceOf(project.address);

    expect(user1_BusdBalance_before.sub(user1_BusdBalance_after)).to.equal(fundingMaxAllocation_user1);
    expect(project_BusdBalance_after.sub(project_BusdBalance_before)).to.equal(fundingMaxAllocation_user1);

    const user1Info = await project.getUserInfo(projectId, user1.address);
    expect(user1Info.isClaimedBack).to.be.false;
    expect(user1Info.usedNft).to.equal('0');
    expect(user1Info.stakedAmount).to.equal('1000000000000000000000');
    expect(user1Info.allocatedPortion).to.equal('1000000000000000000000');
    expect(user1Info.fundedAmount).to.equal(fundingMaxAllocation_user1);
    expect(user1Info.tokenAllocationAmount).to.equal(fundingMaxAllocation_user1.mul(10)); // div(0.1) <=> mul(10)

    fundedTotalAmount_expect = fundingMaxAllocation_user1;
    const projectInfo = await project.getProjectInfo(projectId);
    expect(projectInfo.fundingInfo.fundedTotalAmount).to.equal(fundedTotalAmount_expect);

    const fundingMaxAllocation_user1_after = await project.getFundingMaxAllocation(projectId, user1.address);
    expect(fundingMaxAllocation_user1_after).to.equal('0');

    await expect(
      project.connect(user1).funding(projectId, fundingMinAllocation)
    ).revertedWith("Amount exceed max allocation");
  });

  it("User 3 funding all allocation portion", async () => {
    const user3_BusdBalance_before = await busd.balanceOf(user3.address);
    const project_BusdBalance_before = await busd.balanceOf(project.address);

    await project.connect(user3).funding(projectId, fundingMaxAllocation_user3);

    const user3_BusdBalance_after = await busd.balanceOf(user3.address);
    const project_BusdBalance_after = await busd.balanceOf(project.address);

    expect(user3_BusdBalance_before.sub(user3_BusdBalance_after)).to.equal(fundingMaxAllocation_user3);
    expect(project_BusdBalance_after.sub(project_BusdBalance_before)).to.equal(fundingMaxAllocation_user3);

    const user3Info = await project.getUserInfo(projectId, user3.address);
    expect(user3Info.isClaimedBack).to.be.false;
    expect(user3Info.usedNft).to.equal('0');
    expect(user3Info.stakedAmount).to.equal('6000000000000000000000');
    expect(user3Info.allocatedPortion).to.equal('6000000000000000000000');
    expect(user3Info.fundedAmount).to.equal(fundingMaxAllocation_user3);
    expect(user3Info.tokenAllocationAmount).to.equal(fundingMaxAllocation_user3.mul(10)); // div(0.1) <=> mul(10)

    fundedTotalAmount_expect = fundedTotalAmount_expect.add(fundingMaxAllocation_user3);
    const projectInfo = await project.getProjectInfo(projectId);
    expect(projectInfo.fundingInfo.fundedTotalAmount).to.equal(fundedTotalAmount_expect);

    const fundingMaxAllocation_user3_after = await project.getFundingMaxAllocation(projectId, user3.address);
    expect(fundingMaxAllocation_user3_after).to.equal('0');

    await expect(
      project.connect(user3).funding(projectId, fundingMinAllocation)
    ).revertedWith("Amount exceed max allocation");
  });

  it("User 4 funding a part of allocation portion", async () => {
    const user4_BusdBalance_before = await busd.balanceOf(user4.address);
    const project_BusdBalance_before = await busd.balanceOf(project.address);

    await project.connect(user4).funding(projectId, '10000000000000000000000'); // 10,000 USD

    const user4_BusdBalance_after = await busd.balanceOf(user4.address);
    const project_BusdBalance_after = await busd.balanceOf(project.address);

    expect(user4_BusdBalance_before.sub(user4_BusdBalance_after)).to.equal('10000000000000000000000');
    expect(project_BusdBalance_after.sub(project_BusdBalance_before)).to.equal('10000000000000000000000');

    const user4Info = await project.getUserInfo(projectId, user4.address);
    expect(user4Info.isClaimedBack).to.be.false;
    expect(user4Info.usedNft).to.equal('0');
    expect(user4Info.stakedAmount).to.equal('10000000000000000000000');
    expect(user4Info.allocatedPortion).to.equal('10000000000000000000000');
    expect(user4Info.fundedAmount).to.equal('10000000000000000000000');
    expect(user4Info.tokenAllocationAmount).to.equal('100000000000000000000000'); // 10k div(0.1) <=> 10k mul(10) = 100k

    fundedTotalAmount_expect = fundedTotalAmount_expect.add('10000000000000000000000');
    const projectInfo = await project.getProjectInfo(projectId);
    expect(projectInfo.fundingInfo.fundedTotalAmount).to.equal(fundedTotalAmount_expect);

    const fundingMaxAllocation_user4_after = await project.getFundingMaxAllocation(projectId, user4.address);
    expect(fundingMaxAllocation_user4_after).to.equal(fundingMaxAllocation_user4.sub('10000000000000000000000'));
  });

  it("User 4 funding remaining of allocation portion", async () => {
    const user4_BusdBalance_before = await busd.balanceOf(user4.address);
    const project_BusdBalance_before = await busd.balanceOf(project.address);

    const remainingAllocation = await project.getFundingMaxAllocation(projectId, user4.address);
    await project.connect(user4).funding(projectId, remainingAllocation); // 37037.03703703703703703 - 10,000 = 27037.03703703703703703 USD

    const user4_BusdBalance_after = await busd.balanceOf(user4.address);
    const project_BusdBalance_after = await busd.balanceOf(project.address);

    expect(user4_BusdBalance_before.sub(user4_BusdBalance_after)).to.equal(remainingAllocation);
    expect(project_BusdBalance_after.sub(project_BusdBalance_before)).to.equal(remainingAllocation);

    const user4Info = await project.getUserInfo(projectId, user4.address);
    expect(user4Info.isClaimedBack).to.be.false;
    expect(user4Info.usedNft).to.equal('0');
    expect(user4Info.stakedAmount).to.equal('10000000000000000000000');
    expect(user4Info.allocatedPortion).to.equal('10000000000000000000000');
    expect(user4Info.fundedAmount).to.equal(fundingMaxAllocation_user4);
    expect(user4Info.tokenAllocationAmount).to.equal(fundingMaxAllocation_user4.mul(10)); // 10k div(0.1) <=> 10k mul(10) = 100k

    fundedTotalAmount_expect = fundedTotalAmount_expect.add(remainingAllocation);
    const projectInfo = await project.getProjectInfo(projectId);
    expect(projectInfo.fundingInfo.fundedTotalAmount).to.equal(fundedTotalAmount_expect);

    const fundingMaxAllocation_user4_after = await project.getFundingMaxAllocation(projectId, user4.address);
    expect(fundingMaxAllocation_user4_after).to.equal('0');

    await expect(
      project.connect(user4).funding(projectId, fundingMinAllocation)
    ).revertedWith("Amount exceed max allocation");
  });

  it("User 5 funding all allocation portion", async () => {
    const user5_BusdBalance_before = await busd.balanceOf(user5.address);
    const project_BusdBalance_before = await busd.balanceOf(project.address);

    await project.connect(user5).funding(projectId, fundingMaxAllocation_user5);

    const user5_BusdBalance_after = await busd.balanceOf(user5.address);
    const project_BusdBalance_after = await busd.balanceOf(project.address);

    expect(user5_BusdBalance_before.sub(user5_BusdBalance_after)).to.equal(fundingMaxAllocation_user5);
    expect(project_BusdBalance_after.sub(project_BusdBalance_before)).to.equal(fundingMaxAllocation_user5);

    const user5Info = await project.getUserInfo(projectId, user5.address);
    expect(user5Info.isClaimedBack).to.be.false;
    expect(user5Info.usedNft).to.equal('1');
    expect(user5Info.stakedAmount).to.equal('0');
    expect(user5Info.allocatedPortion).to.equal('10000000000000000000000');
    expect(user5Info.fundedAmount).to.equal(fundingMaxAllocation_user5);
    expect(user5Info.tokenAllocationAmount).to.equal(fundingMaxAllocation_user5.mul(10)); // div(0.1) <=> mul(10)

    fundedTotalAmount_expect = fundedTotalAmount_expect.add(fundingMaxAllocation_user5);
    const projectInfo = await project.getProjectInfo(projectId);
    expect(projectInfo.fundingInfo.fundedTotalAmount).to.equal(fundedTotalAmount_expect);

    const fundingMaxAllocation_user5_after = await project.getFundingMaxAllocation(projectId, user5.address);
    expect(fundingMaxAllocation_user5_after).to.equal('0');

    await expect(
      project.connect(user5).funding(projectId, fundingMinAllocation)
    ).revertedWith("Amount exceed max allocation");
  });

  it("User 1, 2, 3, 4, 5 claim back GMI", async () => {
    await skipBlock(200);

    const user1TokenBalance_before = await token.balanceOf(user1.address);
    const user2TokenBalance_before = await token.balanceOf(user2.address);
    const user3TokenBalance_before = await token.balanceOf(user3.address);
    const user4TokenBalance_before = await token.balanceOf(user4.address);
    const user5TokenBalance_before = await token.balanceOf(user5.address);
    const projectTokenBalance_before = await token.balanceOf(project.address);

    await project.connect(user1).claimBack(projectId);
    await project.connect(user2).claimBack(projectId);
    await project.connect(user3).claimBack(projectId);
    await project.connect(user4).claimBack(projectId);
    await expect(
      project.connect(user5).claimBack(projectId)
    ).revertedWith("Nothing to claim back");

    const user1TokenBalance_after = await token.balanceOf(user1.address);
    const user2TokenBalance_after = await token.balanceOf(user2.address);
    const user3TokenBalance_after = await token.balanceOf(user3.address);
    const user4TokenBalance_after = await token.balanceOf(user4.address);
    const user5TokenBalance_after = await token.balanceOf(user5.address);
    const projectTokenBalance_after = await token.balanceOf(project.address);

    expect(user1TokenBalance_after.sub(user1TokenBalance_before)).to.equal('1000000000000000000000');
    expect(user2TokenBalance_after.sub(user2TokenBalance_before)).to.equal('2000000000000000000000');
    expect(user3TokenBalance_after.sub(user3TokenBalance_before)).to.equal('6000000000000000000000');
    expect(user4TokenBalance_after.sub(user4TokenBalance_before)).to.equal('10000000000000000000000');
    expect(user5TokenBalance_after.sub(user5TokenBalance_before)).to.equal('0');
    expect(projectTokenBalance_before.sub(projectTokenBalance_after)).to.equal('19000000000000000000000');
    expect(projectTokenBalance_after).to.equal('0');

    const user1Info = await project.getUserInfo(projectId, user1.address);
    const user2Info = await project.getUserInfo(projectId, user2.address);
    const user3Info = await project.getUserInfo(projectId, user3.address);
    const user4Info = await project.getUserInfo(projectId, user4.address);
    const user5Info = await project.getUserInfo(projectId, user5.address);

    expect(user1Info.isClaimedBack).to.be.true;
    expect(user2Info.isClaimedBack).to.be.true;
    expect(user3Info.isClaimedBack).to.be.true;
    expect(user4Info.isClaimedBack).to.be.true;
    expect(user5Info.isClaimedBack).to.be.false;
  });

  it("Admin send funded BUSD to funding receiver", async () => {
    const fundingReceiver_BusdBalance_before = await busd.balanceOf(fundingReceiver.address);
    const project_BusdBalance_before = await busd.balanceOf(project.address);

    await project.connect(admin).withdrawFunding(projectId);

    const fundingReceiver_BusdBalance_after = await busd.balanceOf(fundingReceiver.address);
    const project_BusdBalance_after = await busd.balanceOf(project.address);

    expect(project_BusdBalance_after).to.equal('0');
    expect(project_BusdBalance_before.sub(project_BusdBalance_after)).to.equal('99999999999999999999999');
    expect(fundingReceiver_BusdBalance_after.sub(fundingReceiver_BusdBalance_before)).to.equal('99999999999999999999999');

    const projectInfo = await project.getProjectInfo(projectId);
    expect(projectInfo.id).to.equal(2);
    expect(projectInfo.allocationSize).to.equal(allocationSize);
    expect(projectInfo.totalTokenAllocated).to.equal('999999999999999999999990');
    expect(projectInfo.stakeInfo.startBlockNumber).to.equal(stakingStartBlockNumber);
    expect(projectInfo.stakeInfo.endBlockNumber).to.equal(stakingEndBlockNumber);
    expect(projectInfo.stakeInfo.minStakeAmount).to.equal(minStakeAmount);
    expect(projectInfo.stakeInfo.maxStakeAmount).to.equal(maxStakeAmount);
    expect(projectInfo.stakeInfo.stakedTotalAmount).to.equal('19000000000000000000000');
    expect(projectInfo.whitelistedTotalPortion).to.equal('27000000000000000000000');
    expect(projectInfo.fundingInfo.startBlockNumber).to.equal(fundingStartBlockNumber);
    expect(projectInfo.fundingInfo.endBlockNumber).to.equal(fundingEndBlockNumber);
    expect(projectInfo.fundingInfo.minAllocation).to.equal(fundingMinAllocation);
    expect(projectInfo.fundingInfo.estimateTokenAllocationRate).to.equal(estimateTokenAllocationRate);
    expect(projectInfo.fundingInfo.fundedTotalAmount).to.equal('99999999999999999999999');
    expect(projectInfo.fundingInfo.fundingReceiver).to.equal(fundingReceiver.address);
    expect(projectInfo.fundingInfo.isWithdrawnFund).to.be.true;
    expect(projectInfo.claimBackInfo.startBlockNumber).to.equal(claimBackStartBlockNumber);
  });
});
