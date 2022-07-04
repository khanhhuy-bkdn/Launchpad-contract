const hre = require("hardhat");
require("dotenv").config();
const fs = require("fs");
const ethers = hre.ethers;
const upgrades = hre.upgrades;
async function main() {
    //Loading accounts
    const accounts = await ethers.getSigners();
    const addresses = accounts.map((item) => item.address);
    const admin = addresses[0];

    // Loading contract factory.
    const MysteriousBox = await ethers.getContractFactory("MysteriousBoxes");
    const Duke = await ethers.getContractFactory("Duke");
    const DukeStaking = await ethers.getContractFactory("DukeStaking");
    // Deploy contracts
    console.log('==================================================================');
    console.log('DEPLOY CONTRACTS');
    console.log('==================================================================');

    const Rand = await ethers.getContractFactory("Rand");
    const rand = await Rand.deploy();
    console.log("Rand          deployed to:", rand.address);

    const duke = await upgrades.deployProxy(Duke, [
        admin,
        "Duke NFT",
        "DUKE",
        rand.address
    ]
    );
    await duke.deployed();
    let dukeVerify = await upgrades.erc1967.getImplementationAddress(
        duke.address
    );
    console.log("Duke                  deployed to:", duke.address);
    console.log("dukeVerify            deployed to:", dukeVerify);

    const mysteriousBox = await upgrades.deployProxy(MysteriousBox, [
        admin,
        "Mysterious Box NFT",
        "MBN",
        "0x88d8defcda194e08a93689fb6888579f6d45851d",
        duke.address
    ]
    );
    await mysteriousBox.deployed();

    let mysteriousBoxVerify = await upgrades.erc1967.getImplementationAddress(
        mysteriousBox.address
    );
    console.log("MysteriousBox                  deployed to:", mysteriousBox.address);
    console.log("mysteriousBoxVerify            deployed to:", mysteriousBoxVerify);

    const dukeStaking = await upgrades.deployProxy(DukeStaking, [
        admin,
        "0x88d8defcda194e08a93689fb6888579f6d45851d",
        "0x88d8defcda194e08a93689fb6888579f6d45851d",
        duke.address,
        process.env.SOLDIER_RATE,
        process.env.POOL_DURATION,
        process.env.TYPE_ID_SOLDIER,
        process.env.SOLDIER_LIMIT

    ]
    );
    await dukeStaking.deployed();

    let dukeStakingVerify = await upgrades.erc1967.getImplementationAddress(
        dukeStaking.address
    );

    console.log("DukeStaking                       deployed to:", dukeStaking.address);
    console.log("dukeStakingVerify                 deployed to:", dukeStakingVerify);

    const dukeStakingPilot = await upgrades.deployProxy(DukeStaking, [
        admin,
        "0x88d8defcda194e08a93689fb6888579f6d45851d",
        "0x88d8defcda194e08a93689fb6888579f6d45851d",
        duke.address,
        process.env.PILOT_RATE,
        process.env.POOL_DURATION,
        process.env.TYPE_ID_PILOT,
        process.env.PILOT_LIMIT

    ]
    );
    await dukeStakingPilot.deployed();

    let dukeStakingPilotVerify = await upgrades.erc1967.getImplementationAddress(
        dukeStakingPilot.address
    );
    console.log("dukeStakingPilot                  deployed to:", dukeStakingPilot.address);
    console.log("dukeStakingPilotVerify            deployed to:", dukeStakingPilotVerify);

    const dukeStakingGeneral = await upgrades.deployProxy(DukeStaking, [
        admin,
        "0x88d8defcda194e08a93689fb6888579f6d45851d",
        "0x88d8defcda194e08a93689fb6888579f6d45851d",
        duke.address,
        process.env.GENERAL_RATE,
        process.env.POOL_DURATION,
        process.env.TYPE_ID_GENERAL,
        process.env.GENERAL_LIMIT

    ]
    );
    await dukeStakingGeneral.deployed();

    let dukeStakingGeneralVerify = await upgrades.erc1967.getImplementationAddress(
        dukeStakingGeneral.address
    );
    console.log("dukeStakingGeneral                deployed to:", dukeStakingGeneral.address);
    console.log("dukeStakingGeneralVerify          deployed to:", dukeStakingGeneralVerify);

    await duke.setAdmin(dukeStakingGeneral.address, true);
    await duke.setAdmin(dukeStakingPilot.address, true);
    await duke.setAdmin(dukeStaking.address, true);
    await duke.setAdmin(mysteriousBox.address, true);

    const contractAddresses = {
        admin: admin,
        gmi: '0x88d8defcda194e08a93689fb6888579f6d45851d',
        rand: "0x281ef06F5e464A337D3a56285b2b328808055e9D",
        duke: duke.address,
        mysteriousBox: mysteriousBox.address,
        dukeStaking: dukeStaking.address,
        dukeStakingPilot: dukeStakingPilot.address,
        dukeStakingGeneral: dukeStakingGeneral.address
    };

    await fs.writeFileSync(
        "contracts.json",
        JSON.stringify(contractAddresses)
    );

    const contractAddresses_verify = {
        admin: admin,
        gmi: "0x88d8defcda194e08a93689fb6888579f6d45851d",
        duke: dukeVerify,
        mysteriousBox: mysteriousBoxVerify,
        dukeStaking: dukeStakingVerify,
        dukeStakingPilot: dukeStakingPilotVerify,
        dukeStakingGeneral: dukeStakingGeneralVerify
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
