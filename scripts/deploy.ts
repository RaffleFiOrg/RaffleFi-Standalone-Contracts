import { ethers } from "hardhat"

const deploy = async () => {
    if (
        !process.env.GOERLI_LINK || 
        !process.env.GOERLI_VRF_WRAPPER || 
        !process.env.WETH_ADDR || 
        !process.env.VRF_CALLBACK_GAS ||
        !process.env.VRF_RETRIES ||
        !process.env.LINK_FEE
    ) {
        throw new Error("Missing config")
    }
    
    const LINK_FEE = process.env.LINK_FEE
    const LINK_ADDR = process.env.GOERLI_LINK
    const VRF_WRAPPER_ADDR = process.env.GOERLI_VRF_WRAPPER
    const WETH = process.env.WETH_ADDR
    const CALLBACK_GAS_LIMIT = process.env.VRF_CALLBACK_GAS
    const VRF_RETRIES = process.env.VRF_RETRIES

    const deployer = (await ethers.getSigners())[0]

    const raffleFiFactory = await ethers.getContractFactory("RaffleFi", deployer)
    const raffleFi = await raffleFiFactory.deploy(
        WETH,
        LINK_ADDR,
        VRF_WRAPPER_ADDR,
        1, // 1 random number needed only
        CALLBACK_GAS_LIMIT,
        VRF_RETRIES,
        LINK_FEE
    )

    await raffleFi.deployed()

    console.log("RaffleFi contract deployed at", raffleFi.address)
}

deploy().catch()