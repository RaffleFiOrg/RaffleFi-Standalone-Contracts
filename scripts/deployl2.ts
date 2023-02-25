import { ethers } from "hardhat"

const deploy = async () => {
    if (
        !process.env.RANDOMIZER_ADDRESS || 
        !process.env.WETH_ADDR || 
        !process.env.RANDOMIZER_CALLBACK_GAS ||
        !process.env.RANDOMIZER_CONFIRMATIONS 
    ) {
        throw new Error("Missing config")
    }
    
    const WETH = process.env.WETH_ADDR
    const RANDOMIZER_ADDRESS = process.env.RANDOMIZER_ADDRESS
    const RANDOMIZER_CALLBACK_GAS = process.env.RANDOMIZER_CALLBACK_GAS
    const RANDOMIZER_CONFIRMATIONS = process.env.RANDOMIZER_CONFIRMATIONS

    const deployer = (await ethers.getSigners())[0]

    const raffleFiFactory = await ethers.getContractFactory("RaffleFi", deployer)
    const raffleFi = await raffleFiFactory.deploy(
        WETH,
        RANDOMIZER_ADDRESS,
        RANDOMIZER_CALLBACK_GAS,
        RANDOMIZER_CONFIRMATIONS
    )

    await raffleFi.deployed()

    console.log("RaffleFi contract deployed at", raffleFi.address)
}

deploy().catch()