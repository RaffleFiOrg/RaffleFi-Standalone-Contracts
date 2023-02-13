import { expect } from "chai"
import { BigNumber, Contract, ContractFactory, utils, Signer, constants } from "ethers";
import { ethers, network } from "hardhat";
import keccak256  from 'keccak256';
import { MerkleTree } from 'merkletreejs'

interface WhitelistData {
    proof: string[],
    rootHash: string
}

/// @notice create a merkle tree from a list of addresses and return 
/// the proof for the first one
const createMerkleTree = (addresses: string[]): WhitelistData => {
    const leafNodes = addresses.map((addr: string) => keccak256(addr))
    const merkleTree = new MerkleTree(leafNodes, keccak256, {sortPairs: true})
    const rootHash = `0x${merkleTree.getRoot().toString("hex")}`
    return {
        proof: merkleTree.getHexProof(leafNodes[0]),
        rootHash: rootHash
    }
}

describe("RaffleFi", function () {
    let raffleFiFactory: ContractFactory
    let raffleFi: Contract 
    let WETH: Contract
    let USDT: Contract 
    let ERC20: Contract
    let FeeOnTransferToken: Contract
    let USDC: Contract
    let erc721_1: Contract
    let erc721_2: Contract
    let badReceiver: Contract
    let LINKContract: Contract 

    let user1: Signer 
    let user2: Signer 
    let user3: Signer 
    let user1Address: string
    let user2Address: string

    if (!process.env.GOERLI_LINK || !process.env.GOERLI_VRF_WRAPPER || !process.env.GOERLI_LINK_WHALE) {
        throw new Error("Missing config")
    }

    const LINK_ADDR = process.env.GOERLI_LINK!
    const VRF_WRAPPER_ADDR = process.env.GOERLI_VRF_WRAPPER!
    const LINK_WHALE = process.env.GOERLI_LINK_WHALE!


    beforeEach(async () => {
        [user1, user2, user3] = await ethers.getSigners()
        user1Address = await user1.getAddress()
        user2Address = await user2.getAddress()

        const WETHFactory = await ethers.getContractFactory("MockWETH")
        WETH = await WETHFactory.deploy('WETH', 'WETH')
        const ERC20Factory = await ethers.getContractFactory("MockERC20")
        USDT = await ERC20Factory.deploy('USDT', 'USDT', 18)
        USDC = await ERC20Factory.deploy('USDC', 'USDC', 6)
        ERC20 = await ERC20Factory.deploy('ERC20', 'ERC20', 18)

        // impersonate LINK whale and transfer tokens
        const whale = await ethers.getImpersonatedSigner(LINK_WHALE)
        LINKContract = await ethers.getContractAt("MockERC20", LINK_ADDR, whale)
      
        const FeeOnTransferFactory = await ethers.getContractFactory("MockERC20Fee")
        FeeOnTransferToken = await FeeOnTransferFactory.deploy('FOTT', 'FOTT', 18)
        
        const ERC721Factory = await ethers.getContractFactory("MockERC721")
        erc721_1 = await ERC721Factory.deploy('ERC721_1', 'ERC721_1')
        erc721_2 = await ERC721Factory.deploy('ERC721_2', 'ERC721_2')

        raffleFiFactory = await ethers.getContractFactory("RaffleFi")
        raffleFi = await raffleFiFactory.deploy(
            WETH.address,
            LINKContract.address,
            VRF_WRAPPER_ADDR,
            1,
            100000,
            3
        )

        const BadReceiverFactory = await ethers.getContractFactory("MockBadRaffleCreator")
        badReceiver = await BadReceiverFactory.deploy(raffleFi.address, LINKContract.address)

        // mint a couple of NFTs 
        await erc721_1.mint(user1Address)
        await erc721_1.mint(user1Address)
        await erc721_1.mint(user2Address)
        await erc721_1.mint(user2Address)
        await erc721_1.mint(badReceiver.address)

        // mint some tokens
        await USDT.mint(user1Address, utils.parseUnits("1000", 18))
        await USDT.mint(user2Address, utils.parseUnits("1000", 18))
        await USDC.mint(user1Address, utils.parseUnits("1000", 6))
        await USDC.mint(user2Address, utils.parseUnits("1000", 6))
        await ERC20.mint(user1Address, utils.parseUnits("1000", 18))
        await ERC20.mint(user2Address, utils.parseUnits("1000", 18))
        await FeeOnTransferToken.mint(user1Address, utils.parseUnits("1000", 18))
        await FeeOnTransferToken.mint(user2Address, utils.parseUnits("1000", 18))
        await LINKContract.connect(whale).transfer(user1Address, utils.parseEther("10000"))
        await LINKContract.connect(whale).transfer(user2Address, utils.parseEther("10000"))
        await LINKContract.connect(whale).transfer(badReceiver.address, utils.parseEther("10000"))
    })

    describe("Setup", async () => {
        it("should have set the correct state variables", async () => {
            expect(await raffleFi.WETH()).to.equal(WETH.address)
            expect(await raffleFi.numberOfWords()).to.equal(1)
            expect(await raffleFi.callbackGasLimit()).to.equal(100000)
            expect(await raffleFi.requestConfirmations()).to.equal(3)
        })
    })

    describe("Create", () => {
        it("should allow to create an ERC721 raffle", async () => {
            await erc721_1.connect(user1).approve(raffleFi.address, 1)
            await raffleFi.createERC721Raffle(
                erc721_1.address,
                1,
                USDT.address,
                new Date().valueOf() + 10000,
                10,
                utils.parseUnits("1", 18),
                constants.HashZero
            )
            // confirm 1 was created
            expect((await raffleFi.raffleCounter()).toString()).to.equal('1')
            // check that the NFT is owned by the contract
            expect(await erc721_1.ownerOf(1)).to.be.eq(raffleFi.address)
            const raffle = await raffleFi.raffles(1)
            expect(raffle.raffleOwner).to.be.eq(user1Address)
            expect(raffle.currency).to.be.eq(USDT.address)
        })
        it("should allow to create an ERC20 raffle", async () => {
            await USDT.connect(user1).approve(raffleFi.address, utils.parseUnits("1", 18))
            await raffleFi.createERC20Raffle(
                USDT.address,
                utils.parseUnits("1", 18),
                USDC.address,
                new Date().valueOf() + 10000,
                10,
                utils.parseUnits("1", 18),
                constants.HashZero
            )
            // confirm 1 was created
            expect((await raffleFi.raffleCounter()).toString()).to.equal('1')
            // check that the NFT is owned by the contract
            expect((await USDT.balanceOf(raffleFi.address)).toString()).to.be.eq(utils.parseUnits("1", 18).toString())
            const raffle = await raffleFi.raffles(1)
            expect(raffle.raffleOwner).to.be.eq(user1Address)
            expect(raffle.currency).to.be.eq(USDC.address)
        })
        it("should not allow to create an ERC721 raffle with a duration shorter than the minimum", async () => {
            await erc721_1.connect(user1).approve(raffleFi.address, 1)
            await expect(raffleFi.createERC721Raffle(
                erc721_1.address,
                1,
                USDT.address,
                0,
                0,
                utils.parseUnits("1", 18),
                constants.HashZero
            )).to.be.revertedWithCustomError(raffleFi, "InvalidEndDate")
        })
        it("should not allow to create an ERC20 raffle with a duration shorter than the minimum", async () => {
            await USDT.connect(user1).approve(raffleFi.address, utils.parseUnits("1", 18))
            await expect(raffleFi.createERC20Raffle(
                USDT.address,
                utils.parseUnits("1", 18),
                USDC.address,
                0,
                0,
                utils.parseUnits("1", 18),
                constants.HashZero
            )).to.be.revertedWithCustomError(raffleFi, "InvalidEndDate")
        })
        it("should not allow to create an ERC721 raffle with 0 tickets", async () => {
            await erc721_1.connect(user1).approve(raffleFi.address, 1)
            await expect(raffleFi.createERC721Raffle(
                erc721_1.address,
                1,
                USDT.address,
                new Date().valueOf() + 10000,
                0,
                utils.parseUnits("1", 18),
                constants.HashZero
            )).to.be.revertedWithCustomError(raffleFi, "NotEnoughTickets")
        })
        it("should not allow to create an ERC20 raffle with 0 tickets", async () => {
            await USDT.connect(user1).approve(raffleFi.address, utils.parseUnits("1", 18))
            await expect(raffleFi.createERC20Raffle(
                USDT.address,
                utils.parseUnits("1", 18),
                USDC.address,
                new Date().valueOf() + 10000,
                0,
                utils.parseUnits("1", 18),
                constants.HashZero
            )).to.be.revertedWithCustomError(raffleFi, "NotEnoughTickets")
        })
        it("should not allow to create an ERC721 for a non existent token", async () => {
            await expect(raffleFi.createERC721Raffle(
                erc721_1.address,
                100,
                USDT.address,
                new Date().valueOf() + 10000,
                10,
                utils.parseUnits("1", 18),
                constants.HashZero
            )).to.be.revertedWith("NOT_MINTED")
        })
        it("should not allow to create an ERC721 raffle for a token that is not owned by the caller", async () => {
            await expect(raffleFi.createERC721Raffle(
                erc721_1.address,
                3, // owned by user2
                USDT.address,
                new Date().valueOf() + 10000,
                10,
                utils.parseUnits("1", 18),
                constants.HashZero
            )).to.be.revertedWithCustomError(raffleFi, "NotYourAsset")
        })
        it("should not allow to create an ERC20 raffle for a quantity greater than the caller's balance", async () => {
            await expect(raffleFi.createERC20Raffle(
                USDT.address,
                utils.parseUnits("1000000", 18),
                USDC.address,
                new Date().valueOf() + 10000,
                10,
                utils.parseUnits("1", 18),
                constants.HashZero
            )).to.be.revertedWithCustomError(raffleFi, "NotEnoughTokens")
        })
        it("should not allow to create a raffle using Ether without sending the correct amount", async () => {
            await expect(raffleFi.createERC20Raffle(
                constants.AddressZero,
                utils.parseEther("1"),
                USDC.address,
                new Date().valueOf() + 10000,
                10,
                utils.parseUnits("1", 18),
                constants.HashZero,
                {
                    value: utils.parseEther("0.5")
                }
            )).to.be.revertedWithCustomError(raffleFi, "NotEnoughEther")
        })
        it("should emit an event when creating a raffle", async () => {
            await erc721_1.connect(user1).approve(raffleFi.address, 1)
            expect(await raffleFi.createERC721Raffle(
                erc721_1.address,
                1,
                USDT.address,
                new Date().valueOf() + 10000,
                10,
                utils.parseUnits("1", 18),
                constants.HashZero
            )).to.emit(raffleFi, 'RaffleCreated').withArgs(BigNumber.from(1))
        })
        it("should not allow to create an ERC20 raffle using a fee on transfer token as asset raffled", async () => {
            await FeeOnTransferToken.connect(user1).mint(user1Address, utils.parseUnits("100000000", 18))
            await FeeOnTransferToken.connect(user1).approve(raffleFi.address, utils.parseUnits("100000000", 18))
            await expect(raffleFi.createERC20Raffle(
                FeeOnTransferToken.address,
                utils.parseUnits("100000000", 18),
                USDC.address,
                new Date().valueOf() + 10000,
                10,
                utils.parseUnits("1", 18),
                constants.HashZero
            )).to.be.revertedWithCustomError(raffleFi, "ERC20NotTransferred")
        })
        it("allows to create a raffle using a smart contract", async () => {
            await badReceiver.connect(user1).createRaffle(
                erc721_1.address,
                5,
                USDT.address,
                new Date().valueOf() + 10000,
                10,
                utils.parseUnits("1", 18),
                constants.HashZero
            )
            const raffle = await raffleFi.raffles(1)
            expect(raffle.raffleOwner).to.be.eq(badReceiver.address)
        })
        it("should allow to create a private raffle", async () => {
            const merkleRoot = createMerkleTree([user1Address, user2Address]).rootHash
            await erc721_1.connect(user1).approve(raffleFi.address, 1)
            await raffleFi.createERC721Raffle(
                erc721_1.address,
                1,
                USDT.address,
                new Date().valueOf() + 10000,
                10,
                utils.parseUnits("1", 18),
                merkleRoot,
            )
            const raffle = await raffleFi.raffles(1)
            expect(raffle.MerkleRoot).to.be.eq(merkleRoot)
        })
    })

    describe("Cancel", () => {
        const USDTQuantity = utils.parseUnits("1", 18)
        beforeEach(async () =>  {
            // raffle 1 ERC721
            await erc721_1.connect(user1).approve(raffleFi.address, 1)
            await raffleFi.createERC721Raffle(
                erc721_1.address,
                1,
                USDT.address,
                new Date().valueOf() + 10000,
                10,
                utils.parseUnits("1", 18),
                constants.HashZero
            )

            // raffle 2 ERC20
            await USDT.connect(user1).approve(raffleFi.address, utils.parseUnits("1", 18))
            await raffleFi.createERC20Raffle(
                USDT.address,
                USDTQuantity,
                USDC.address,
                new Date().valueOf() + 10000,
                10,
                utils.parseUnits("1", 18),
                constants.HashZero
            )
        })
        it("should allow to cancel an ERC721 raffle", async () => {
            expect(await erc721_1.ownerOf(1)).to.be.eq(raffleFi.address)
            await raffleFi.connect(user1).cancelRaffle(1)
            const raffle = await raffleFi.raffles(1)
            expect(raffle.raffleState).to.be.eq(3) // REFUNDED
            expect(await erc721_1.ownerOf(1)).to.be.eq(user1Address)
        })
        it("should allow to cancel an ERC20 raffle", async () => {
            const balanceBefore = await USDT.balanceOf(user1Address)
            await raffleFi.connect(user1).cancelRaffle(2)
            const raffle = await raffleFi.raffles(2)
            expect(raffle.raffleState).to.be.eq(3) // REFUNDED
            const balanceAfter = await USDT.balanceOf(user1Address)
            expect(balanceBefore.add(USDTQuantity)).to.be.eq(balanceAfter)
        })
        it("should refund Ether when cancelling an Ether raffle", async () => {
            const etherAmount = utils.parseEther("1")
            await raffleFi.createERC20Raffle(
                constants.AddressZero,
                etherAmount,
                USDT.address,
                new Date().valueOf() + 10000,
                10,
                utils.parseUnits("1", 18),
                constants.HashZero,
                {
                    value: utils.parseEther("1")
                }
            )
            // get ether balance before 
            const balanceBefore = await user1.getBalance()
            await raffleFi.connect(user1).cancelRaffle(3)
            const raffle = await raffleFi.raffles(3)
            expect(raffle.raffleState).to.be.eq(3) // REFUNDED
            const balanceAfter = await user1.getBalance()
            expect(balanceAfter).to.be.gt(balanceBefore)
        })
        it("should prevent cancelling a raffle that is not in the correct state", async () => {
            await raffleFi.connect(user1).cancelRaffle(1)
            await expect(raffleFi.connect(user1).cancelRaffle(1)).to.be.revertedWithCustomError(raffleFi, "RaffleNotInProgress")
        })
        it("should emit an event when cancelling a raffle", async () => {
            await expect(raffleFi.connect(user1).cancelRaffle(1))
            .to.emit(raffleFi, 'RaffleCancelled')
            .withArgs(BigNumber.from(1))
            .to.emit(raffleFi, 'RaffleStateChanged')
            .withArgs(BigNumber.from(1), BigNumber.from(0), BigNumber.from(3))      
        })
        it("should prevent cancelling someone else's raffle", async () => {
            await expect(raffleFi.connect(user2).cancelRaffle(1)).to.be.revertedWithCustomError(raffleFi, "NotYourRaffle")
        })
        it("should still allow the raffle creator to cancel and get their asset back if there is an error with buying tickets", async () => {
            // Ticket buy failure
            // create raffle with fee on transfer
            const ticketPriceFeeOnTransfer = utils.parseUnits("100000", 18)
            const nftToBeRaffled = 2
            await erc721_1.connect(user1).approve(raffleFi.address, nftToBeRaffled)
            await raffleFi.connect(user1).createERC721Raffle(
                erc721_1.address,
                nftToBeRaffled,
                FeeOnTransferToken.address,
                new Date().valueOf() + 10000,
                10,
                ticketPriceFeeOnTransfer,
                constants.HashZero
            )
            await FeeOnTransferToken.connect(user2).mint(user2Address, ticketPriceFeeOnTransfer)
            await FeeOnTransferToken.connect(user2).approve(raffleFi.address, ticketPriceFeeOnTransfer)    
            await expect(raffleFi.connect(user2).buyRaffleTicket(3, 1, [])).to.be.revertedWithCustomError(raffleFi, "ERC20NotTransferred")

            await expect(raffleFi.connect(user1).cancelRaffle(3))
            .to.emit(raffleFi, 'RaffleCancelled')
            .withArgs(BigNumber.from(3))
            .to.emit(raffleFi, 'RaffleStateChanged')
            .withArgs(BigNumber.from(3), BigNumber.from(0), BigNumber.from(3))     

            // check that user1 got his asset back
            expect(await erc721_1.ownerOf(nftToBeRaffled)).to.be.eq(user1Address)
        })
        it("should not allow to buy tickets after the raffle has been cancelled", async () => {
            await raffleFi.connect(user1).cancelRaffle(1)
            await expect(raffleFi.connect(user2).buyRaffleTicket(1, 1, [])).to.be.revertedWithCustomError(raffleFi, "RaffleNotInProgress")
        })
        it("should not allow to cancel a raffle twice", async () => {
            await raffleFi.connect(user1).cancelRaffle(1)
            await expect(raffleFi.connect(user1).cancelRaffle(1)).to.be.revertedWithCustomError(raffleFi, "RaffleNotInProgress")
        })
        it("should prevent cancelling a raffle that has already been drawn", async () => {})
        it("should prevent canceling a raffle that does not exist", async () => {
            // raffleOwner -> address(0) -> NotYourRaffle 
            await expect(raffleFi.connect(user1).cancelRaffle(3)).to.be.revertedWithCustomError(raffleFi, "NotYourRaffle")
        })
        it("should return the correct amount of Ether via WETH to a bad receiver contract (revert in receive)", async () => {
            const wethBalanceBefore = await WETH.balanceOf(badReceiver.address)
            expect(wethBalanceBefore).to.be.eq(0)
            await badReceiver.createERC20Raffle(
                constants.AddressZero,
                utils.parseEther("1"),
                USDT.address,
                new Date().valueOf() + 10000,
                10,
                utils.parseUnits("1", 18),
                constants.HashZero,
                {
                    value: utils.parseEther("1")
                }
            )
            await badReceiver.connect(user1).cancelRaffle(3)
            const wethBalance = await WETH.balanceOf(badReceiver.address)
            expect(wethBalance).to.be.eq(utils.parseUnits("1", 18))
        })
        it("should allow to cancel a private raffle", async () => {
            const merkleRoot = createMerkleTree([user1Address, user2Address]).rootHash
            expect(await erc721_1.ownerOf(2)).to.be.eq(user1Address)
            await erc721_1.connect(user1).approve(raffleFi.address, 2)
            await raffleFi.createERC721Raffle(
                erc721_1.address,
                2,
                USDT.address,
                new Date().valueOf() + 10000,
                10,
                utils.parseUnits("1", 18),
                merkleRoot,
            )
            expect(await erc721_1.ownerOf(2)).to.be.eq(raffleFi.address)
            await raffleFi.connect(user1).cancelRaffle(3)
            expect(await raffleFi.getRaffleState(3)).to.be.eq(3)
            expect(await erc721_1.ownerOf(2)).to.be.eq(user1Address)
        })
    })

    describe("Buy", () => {
        const ticketPriceUSDT = utils.parseUnits("1", 18)
        const ticketPriceUSDC = utils.parseUnits("1", 6)
        const numOfTickets = 10
        beforeEach(async () =>  {
            // raffle 1 ERC721
            await erc721_1.connect(user1).approve(raffleFi.address, 1)
            await raffleFi.createERC721Raffle(
                erc721_1.address,
                1,
                USDT.address,
                new Date().valueOf() + 10000,
                numOfTickets,
                ticketPriceUSDT,
                constants.HashZero
            )

            // raffle 2 ERC20
            await USDT.connect(user1).approve(raffleFi.address, utils.parseUnits("1", 18))
            await raffleFi.createERC20Raffle(
                USDT.address,
                utils.parseUnits("1", 18),
                USDC.address,
                new Date().valueOf() + 10000,
                numOfTickets,
                ticketPriceUSDC,
                constants.HashZero
            )
        })
        it("should allow to buy a ticket for an ERC721 raffle", async () => {
            await USDT.connect(user2).approve(raffleFi.address, ticketPriceUSDT)
            await raffleFi.connect(user2).buyRaffleTicket(1, 1, [])
            const raffle = await raffleFi.raffles(1)
            expect(raffle.ticketsSold).to.be.eq(1)
            
        })
        it("should allow to buy a ticket for an ERC20 raffle", async () => {
            await USDC.connect(user2).approve(raffleFi.address, ticketPriceUSDC)
            await raffleFi.connect(user2).buyRaffleTicket(2, 1, [])
            const raffle = await raffleFi.raffles(2)
            expect(raffle.ticketsSold).to.be.eq(1)
        })
        it("should allow to buy multiple tickets for an ERC721 raffle", async () => {
            await USDT.connect(user2).approve(raffleFi.address, ticketPriceUSDT.mul(10))
            await raffleFi.connect(user2).buyRaffleTicket(1, 10, [])
            const raffle = await raffleFi.raffles(1)
            expect(raffle.ticketsSold).to.be.eq(10)
        })
        it("should allow to buy multiple tickets for an ERC20 raffle", async () => {
            await USDC.connect(user2).approve(raffleFi.address, ticketPriceUSDC.mul(10))
            await raffleFi.connect(user2).buyRaffleTicket(2, 10, [])
            const raffle = await raffleFi.raffles(2)
            expect(raffle.ticketsSold).to.be.eq(10)
        })
        it("should assign the tickets to the correct buyer", async () => {
            await USDC.connect(user2).approve(raffleFi.address, ticketPriceUSDC.mul(5))
            await raffleFi.connect(user2).buyRaffleTicket(2, 5, [])
            for (let i = 0; i < 5; i++) {
                expect(await raffleFi.getTicketOwner(2, i)).to.be.eq(user2Address)
            }
        })
        it("should not allow to buy more tickets than the available ones", async () => {
            await USDT.connect(user2).approve(raffleFi.address, ticketPriceUSDT.mul(10))
            await expect(raffleFi.connect(user2).buyRaffleTicket(1, 11, []))
            .to.be.revertedWithCustomError(raffleFi, "NotEnoughTicketsAvailable")
        })
        it("should not allow to buy tickets once sold out", async () => {
            await USDC.connect(user2).approve(raffleFi.address, ticketPriceUSDC.mul(11))
            await raffleFi.connect(user2).buyRaffleTicket(2, 10, [])
            await expect(raffleFi.buyRaffleTicket(2, 1, []))
            .to.be.revertedWithCustomError(raffleFi, "TicketsSoldOut")
        })
        it("should allow to buy a ticket for a whitelisted raffle", async () => {
        })
        it("should emit an event when buying a ticket", async () => {
            await USDT.connect(user2).approve(raffleFi.address, ticketPriceUSDT)
            await expect(raffleFi.connect(user2).buyRaffleTicket(1, 1, []))
            .to.emit(raffleFi, 'NewRaffleTicketBought')
            .withArgs(BigNumber.from(1), user2Address, BigNumber.from(1), BigNumber.from(0), BigNumber.from(0))
        })
        it("should not allow to buy a ticket for a raffle that uses a fee on transfer token as currency", async () => {
            // create raffle with fee on transfer
            const ticketPriceFeeOnTransfer = utils.parseUnits("100000", 18)
            await erc721_1.connect(user1).approve(raffleFi.address, 2)
            await raffleFi.createERC721Raffle(
                erc721_1.address,
                2,
                FeeOnTransferToken.address,
                new Date().valueOf() + 10000,
                10,
                ticketPriceFeeOnTransfer,
                constants.HashZero
            )
            await FeeOnTransferToken.connect(user2).mint(user2Address, ticketPriceFeeOnTransfer)
            await FeeOnTransferToken.connect(user2).approve(raffleFi.address, ticketPriceFeeOnTransfer)    
            await expect(raffleFi.connect(user2).buyRaffleTicket(3, 1, [])).to.be.revertedWithCustomError(raffleFi, "ERC20NotTransferred")
        })
        it("should allow to buy tickets for a private raffle", async () => {
            // create whitelisted raffle
            await erc721_1.connect(user1).approve(raffleFi.address, 2)
            const merkleTreeData = createMerkleTree([user2Address, user1Address])
            await raffleFi.createERC721Raffle(
                erc721_1.address,
                2,
                USDT.address,
                new Date().valueOf() + 10000,
                10,
                ticketPriceUSDT,
                merkleTreeData.rootHash
            )
            // buy ticket
            await USDT.connect(user2).approve(raffleFi.address, ticketPriceUSDT)
            await raffleFi.connect(user2).buyRaffleTicket(3, 1, merkleTreeData.proof)
            const raffle = await raffleFi.raffles(3)
            expect(raffle.ticketsSold).to.be.eq(1)
            const ticketOwner = await raffleFi.getTicketOwner(3, 0)
            expect(ticketOwner).to.be.eq(user2Address)
        })
        it("should not allow to buy tickets for a private raffle without a valid proof and being whitelisted", async () => {
            // create whitelisted raffle
            await erc721_1.connect(user1).approve(raffleFi.address, 2)
            const merkleTreeData = createMerkleTree([user2Address, user1Address])
            await raffleFi.createERC721Raffle(
                erc721_1.address,
                2,
                USDT.address,
                new Date().valueOf() + 10000,
                10,
                ticketPriceUSDT,
                merkleTreeData.rootHash
            )
            // buy ticket
            await USDT.connect(user3).approve(raffleFi.address, ticketPriceUSDT)
            await expect(raffleFi.connect(user3).buyRaffleTicket(3, 1, []))
            .to.be.revertedWithCustomError(raffleFi, "UserNotWhitelisted")
        })
        it("should not allow to buy tickets for a private raffle with a valid proof of another user", async () => {
            // create whitelisted raffle
            await erc721_1.connect(user1).approve(raffleFi.address, 2)
            const merkleTreeData = createMerkleTree([user2Address, user1Address])
            await raffleFi.createERC721Raffle(
                erc721_1.address,
                2,
                USDT.address,
                new Date().valueOf() + 10000,
                10,
                ticketPriceUSDT,
                merkleTreeData.rootHash
            )
            // buy ticket
            await USDT.connect(user3).approve(raffleFi.address, ticketPriceUSDT)
            await expect(raffleFi.connect(user3).buyRaffleTicket(3, 1, merkleTreeData.proof))
            .to.be.revertedWithCustomError(raffleFi, "UserNotWhitelisted")
        })
    })

    describe("Refund", () => {
        const ticketPriceUSDT = utils.parseUnits("1", 18)
        const ticketPriceUSDC = utils.parseUnits("1", 6)
        beforeEach(async () =>  {
            // raffle 1 ERC721
            await erc721_1.connect(user1).approve(raffleFi.address, 1)
            await raffleFi.createERC721Raffle(
                erc721_1.address,
                1,
                USDT.address,
                new Date().valueOf() + 10000,
                10,
                ticketPriceUSDT,
                constants.HashZero
            )

            // raffle 2 ERC20
            await USDT.connect(user1).approve(raffleFi.address, ticketPriceUSDT)
            await raffleFi.createERC20Raffle(
                USDT.address,
                utils.parseUnits("1", 18),
                USDC.address,
                new Date().valueOf() + 10000,
                10,
                ticketPriceUSDC,
                constants.HashZero
            )

            // buy tickets on raffle one
            await USDT.connect(user2).approve(raffleFi.address, ticketPriceUSDT.mul(10))
            await raffleFi.connect(user2).buyRaffleTicket(1, 10, [])

            // cancel raffle one 
            await raffleFi.connect(user1).cancelRaffle(1)
        })
        it("should allow to refund a ticket for an ERC721 raffle if cancelled", async () => {
            const balanceBefore = await USDT.balanceOf(user2Address)
            await raffleFi.connect(user2).claimCancelledRaffle(1, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
            const balanceAfter = await USDT.balanceOf(user2Address)
            expect(balanceBefore.add(ticketPriceUSDT.mul(10))).to.be.eq(balanceAfter)
        })
        it("should allow to refund a ticket for an ERC20 raffle if cancelled", async () => {
            await USDC.connect(user2).approve(raffleFi.address, ticketPriceUSDC.mul(10))
            await raffleFi.connect(user2).buyRaffleTicket(2, 10, [])
            await raffleFi.connect(user1).cancelRaffle(2)
            const balanceBefore = await USDC.balanceOf(user2Address)
            await raffleFi.connect(user2).claimCancelledRaffle(2, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
            const balanceAfter = await USDC.balanceOf(user2Address)
            expect(balanceBefore.add(ticketPriceUSDC.mul(10))).to.be.eq(balanceAfter)
        })
        it("should not refund twice", async () => {
            const balanceBefore = await USDT.balanceOf(user2Address)
            await raffleFi.connect(user2).claimCancelledRaffle(1, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
            const balanceAfter = await USDT.balanceOf(user2Address)
            expect(balanceBefore.add(ticketPriceUSDT.mul(10))).to.be.eq(balanceAfter)
            await expect(raffleFi.connect(user2).claimCancelledRaffle(1, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])).
            to.be.revertedWithCustomError(raffleFi, "NotTicketOwner")
        })
        it("should not refund if no tickets were bought", async () => {
            await expect(raffleFi.connect(user3).claimCancelledRaffle(1, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]))
            .to.be.revertedWithCustomError(raffleFi, "NotTicketOwner")
        })
        it("should not refund someone else's ticket", async () => {
            await expect(raffleFi.connect(user3).claimCancelledRaffle(1, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]))
            .to.be.revertedWithCustomError(raffleFi, "NotTicketOwner")
        })
        it("should not refund if the raffle was completed", async () => {})
    })

    describe("Complete", () => {
        const ticketPriceUSDT = utils.parseUnits("1", 18)
        const ticketPriceUSDC = utils.parseUnits("1", 6)
        beforeEach(async () => {
            // raffle 1 ERC721
            await erc721_1.connect(user1).approve(raffleFi.address, 1)
            await raffleFi.createERC721Raffle(
                erc721_1.address,
                1,
                USDT.address,
                (await ethers.provider.getBlock("latest")).timestamp + 60 * 60 * 2,
                10,
                ticketPriceUSDT,
                constants.HashZero
            )

            // raffle 2 ERC20
            await USDT.connect(user1).approve(raffleFi.address, utils.parseUnits("1", 18))
            await raffleFi.createERC20Raffle(
                USDT.address,
                utils.parseUnits("1", 18),
                USDC.address,
                (await ethers.provider.getBlock("latest")).timestamp + 60 * 60 * 2,
                10,
                ticketPriceUSDC,
                constants.HashZero
            )

            // buy tickets for ERC721 raffle
            await USDT.connect(user2).approve(raffleFi.address, ticketPriceUSDT.mul(10))
            await raffleFi.connect(user2).buyRaffleTicket(1, 10, [])

            // buy tickets for ERC20 raffle
            await USDC.connect(user2).approve(raffleFi.address, ticketPriceUSDC.mul(5))
            await raffleFi.connect(user2).buyRaffleTicket(2, 5, [])

            // approve LINK 
            await LINKContract.connect(user1).approve(raffleFi.address, constants.MaxUint256)
        })
        it("should allow to complete an ERC721 raffle with all tickets sold (set state to FINISHED)", async () => {
            
            await raffleFi.connect(user1).completeRaffle(1, true)
            const raffle = await raffleFi.getRaffleDetails(1)
            expect(raffle.raffleState).to.be.eq(1) // FINISHED
            expect(raffle.ticketsSold).to.be.eq(10)
        })
        it("should allow to complete an ERC20 raffle with all tickets sold (set state to FINISHED)", async () => {
            
            await USDC.connect(user2).approve(raffleFi.address, ticketPriceUSDC.mul(5))
            await raffleFi.connect(user2).buyRaffleTicket(2, 5, [])
            
            await raffleFi.connect(user1).completeRaffle(2, true)
            const raffle = await raffleFi.getRaffleDetails(2)
            expect(raffle.raffleState).to.be.eq(1) // FINISHED
            expect(raffle.ticketsSold).to.be.eq(10)
        })
        it("should decrease the LINK balance of the owner", async () => { 
            const balanceBefore = await LINKContract.balanceOf(user1Address)
            await raffleFi.connect(user1).completeRaffle(1, true)
            const balanceAfter = await LINKContract.balanceOf(user1Address)
            expect(balanceBefore).to.be.gt(balanceAfter)
        })
        it("should successfully store a chailink VRF request id", async () => {
            const tx = await raffleFi.connect(user1).completeRaffle(1, true)
            const receipt = await tx.wait()
            const requestId = receipt.events[5].args[0].toString()
            
            const raffleId = await raffleFi.vrfRequestToRaffleID(requestId)
            expect(raffleId.toString()).to.be.eq('1')
           
        })
        it("should not allow to complete someone else's raffle", async () => {
            await expect(raffleFi.connect(user2).completeRaffle(1, true))
            .to.be.revertedWithCustomError(raffleFi, "NotYourRaffle")
        })
        it("should allow to complete a raffle with less tickets sold than expected if creator agrees", async () => {
            // move in time
            await network.provider.send("evm_increaseTime", [60 * 60 * 2])
            await network.provider.send("evm_mine")
            
            await raffleFi.connect(user1).completeRaffle(2, true)
            const raffle = await raffleFi.getRaffleDetails(2)
            expect(raffle.raffleState).to.be.eq(1) // FINISHED
        })
        it("should set the raffle to REFUNDED if the creator does not agree to complete with less tickets sold than expected", async () => {
            await network.provider.send("evm_increaseTime", [60 * 60 * 2])
            await network.provider.send("evm_mine")
            
            await raffleFi.connect(user1).completeRaffle(2, false)
            const raffle = await raffleFi.getRaffleDetails(2)
            expect(raffle.raffleState).to.be.eq(3) // REFUNDED
        })
        it("should send the NFT back to the raffle creator if the raffle doet not complete (erc721 raffle)", async () => {
            // create another raffle
            await erc721_1.connect(user1).approve(raffleFi.address, 2)
            await raffleFi.createERC721Raffle(
                erc721_1.address,
                2,
                USDT.address,
                (await ethers.provider.getBlock("latest")).timestamp + 60 * 60 * 2,
                10,
                ticketPriceUSDT,
                constants.HashZero
            )
            expect(await erc721_1.ownerOf(2)).to.be.eq(raffleFi.address)
            // don't buy any tickets
            // send forward time
            await network.provider.send("evm_increaseTime", [60 * 60 * 2])
            await network.provider.send("evm_mine")
            
            await raffleFi.connect(user1).completeRaffle(3, false) 
            const raffle = await raffleFi.getRaffleDetails(3)
            expect(raffle.raffleState).to.be.eq(3) // REFUNDED
            expect(await erc721_1.ownerOf(2)).to.be.eq(user1Address)
        })
        it("should send the tokens back to the raffle creator if the raffle doet not complete (erc20 raffle)", async () => {
            const balanceBefore = await USDT.balanceOf(user1Address)
            await network.provider.send("evm_increaseTime", [60 * 60 * 2])
            await network.provider.send("evm_mine")
            
            await raffleFi.connect(user1).completeRaffle(2, false) 
            const raffle = await raffleFi.getRaffleDetails(2) 
            expect(raffle.raffleState).to.be.eq(3) // REFUNDED
            const balanceAfter = await USDT.balanceOf(user1Address)
            expect(balanceBefore.add(utils.parseEther("1"))).to.be.eq(balanceAfter)
        })
        it("should refund the ether for a erc20 raffle with ether as currency and not enough tickets sold + creator not agreeing to complete", async () => {
            // create another raffle
            const ticketPriceUSDT = utils.parseUnits("0.1", 18)
            await raffleFi.createERC20Raffle(
                constants.AddressZero,
                utils.parseEther("1"),
                USDT.address,
                (await ethers.provider.getBlock("latest")).timestamp + 60 * 60 * 2,
                10,
                ticketPriceUSDT,
                constants.HashZero,
                {
                    value: utils.parseEther("1")
                }
            )
            // buy 1 ticket
            await USDT.connect(user2).approve(raffleFi.address, ticketPriceUSDT)
            await raffleFi.connect(user2).buyRaffleTicket(3, 1, [])
            // send forward time
            await network.provider.send("evm_increaseTime", [60 * 60 * 2])
            await network.provider.send("evm_mine")
            // balance ether before
            const balanceBefore = await ethers.provider.getBalance(user1Address)
            // complete raffle
            
            await raffleFi.connect(user1).completeRaffle(3, false) 
            const raffle = await raffleFi.getRaffleDetails(3)
            expect(raffle.raffleState).to.be.eq(3) // REFUNDED
            // check ether balance
            const balanceAfter = await ethers.provider.getBalance(user1Address)
            expect(balanceAfter).to.be.gt(balanceBefore)

        })
        it("(bad receiver reverting on receive) should refund the ether as WETH for a erc20 raffle with ether as currency and not enough tickets sold + creator not agreeing to complete", async () => {
            // create another raffle
            const wethBalanceBefore = await WETH.balanceOf(badReceiver.address)
            expect(wethBalanceBefore).to.be.eq(0)
            await badReceiver.createERC20Raffle(
                constants.AddressZero,
                utils.parseEther("1"),
                USDT.address,
                (await ethers.provider.getBlock("latest")).timestamp + 60 * 60 * 2,
                10,
                utils.parseUnits("1", 18),
                constants.HashZero,
                {
                    value: utils.parseEther("1")
                }
            )

            // travel in time     
            await network.provider.send("evm_increaseTime", [60 * 60 * 2])
            await network.provider.send("evm_mine")
            await badReceiver.connect(user1).completeRaffle(3, false)
            const wethBalance = await WETH.balanceOf(badReceiver.address)
            expect(wethBalance).to.be.eq(utils.parseUnits("1", 18))
            const raffle = await raffleFi.getRaffleDetails(3)
            expect(raffle.raffleState).to.be.eq(3) // REFUNDED
        })
        it("should not allow to complete an ERC721 raffle if not all tickets were sold or deadline passed", async () => {
            // create another erc721 raffle
            await erc721_1.connect(user1).approve(raffleFi.address, 2)
            await raffleFi.createERC721Raffle(
                erc721_1.address,
                2,
                USDT.address,
                (await ethers.provider.getBlock("latest")).timestamp + 60 * 60 * 2,
                10,
                ticketPriceUSDT,
                constants.HashZero
            )
            
            await expect(raffleFi.connect(user1).completeRaffle(3, true))
            .to.be.revertedWithCustomError(raffleFi, "RaffleNotEnded")
        })
        it("should not allow to complete an ERC20 raffle if not all tickets were sold or deadline passed", async () => {
            
            await expect(raffleFi.connect(user1).completeRaffle(2, true))
            .to.be.revertedWithCustomError(raffleFi, "RaffleNotEnded")
        })
        it("should emit an event when completing a raffle", async () => {
            
            expect(await raffleFi.connect(user1).completeRaffle(1, true))
            .to.emit(raffleFi, "RaffleStateChanged").withArgs(
                BigNumber.from(0), // IN_PROGRESS
                BigNumber.from(1) // FINISHED
            )
            .to.emit(raffleFi, "VRFRequest")   
        })
        it("should not complete a raffle that is cancelled", async () => {
            
            await raffleFi.connect(user1).cancelRaffle(1)
            await expect(raffleFi.connect(user1).completeRaffle(1, true))
            .to.be.revertedWithCustomError(raffleFi, "RaffleNotInProgress")
        })
        it("should not allow to complete a raffle that is already completed", async () => {
            
            expect(await raffleFi.connect(user1).completeRaffle(1, true))
            .to.emit(raffleFi, "RaffleStateChanged").withArgs(
                BigNumber.from(0), // IN_PROGRESS
                BigNumber.from(1) // FINISHED
            )
            .to.emit(raffleFi, "VRFRequest") 
            await expect(raffleFi.connect(user1).completeRaffle(1, true))
            .to.be.revertedWithCustomError(raffleFi, "RaffleNotInProgress")
        })
        it("should not allow to complete a raffle that is refunded", async () => {
            await network.provider.send("evm_increaseTime", [60 * 60 * 2])
            await network.provider.send("evm_mine")
            await raffleFi.connect(user1).completeRaffle(2, false)
            
            await expect(raffleFi.connect(user1).completeRaffle(2, true))
            .to.be.revertedWithCustomError(raffleFi, "RaffleNotInProgress")
        })
        /// can only be tested in live network 
        it("should have awarded a user after completing", async () => {
            if (network.config.chainId !== 5) { return }
            
            expect(await raffleFi.connect(user1).completeRaffle(1, true))
            .to.emit(raffleFi, "RaffleStateChanged").withArgs(
                BigNumber.from(0), // IN_PROGRESS
                BigNumber.from(1) // FINISHED
            )
            .to.emit(raffleFi, "VRFRequest")   
            const raffle = await raffleFi.getRaffleDetails(1)
            expect(raffle.raffleWinner).to.be.eq(user2Address) // only one that bought tickets
        })
        it("should allow a user to get a refund after the raffle was completed but did not sell out", async () => {
            await network.provider.send("evm_increaseTime", [60 * 60 * 2])
            await network.provider.send("evm_mine")
            
            await raffleFi.connect(user1).completeRaffle(2, false)
            
            const balanceBefore = await USDC.balanceOf(user2Address)
            await raffleFi.connect(user2).claimCancelledRaffle(2, [
                0, 1, 2, 3, 4
            ])
            const balanceAfter = await USDC.balanceOf(user2Address)
            expect(balanceAfter.sub(balanceBefore)).to.be.eq(ticketPriceUSDC.mul(5))
        })
        it("should not give a refund for other people's tickets even after completing a raffle that goes into refunded state", async () => {
            await network.provider.send("evm_increaseTime", [60 * 60 * 2])
            await network.provider.send("evm_mine")
            
            await raffleFi.connect(user1).completeRaffle(2, false)
            await expect(raffleFi.connect(user2).claimCancelledRaffle(2, [
                0, 1, 2, 3, 4, 5
            ])).to.be.revertedWithCustomError(raffleFi, "NotTicketOwner")
        })
    })

    // only to be tested on goerli 
    describe("Claim", () => {
        const ticketPriceUSDT = utils.parseUnits("1", 18)
        const ticketPriceUSDC = utils.parseUnits("1", 6)
        beforeEach(async () => {
            // raffle 1 ERC721
            await erc721_1.connect(user1).approve(raffleFi.address, 1)
            await raffleFi.createERC721Raffle(
                erc721_1.address,
                1,
                USDT.address,
                (await ethers.provider.getBlock("latest")).timestamp + 60 * 60 * 2,
                10,
                ticketPriceUSDT,
                constants.HashZero
            )

            // raffle 2 ERC20
            await USDT.connect(user1).approve(raffleFi.address, utils.parseUnits("1", 18))
            await raffleFi.createERC20Raffle(
                USDT.address,
                utils.parseUnits("1", 18),
                USDC.address,
                (await ethers.provider.getBlock("latest")).timestamp + 60 * 60 * 2,
                10,
                ticketPriceUSDC,
                constants.HashZero
            )

            // buy tickets for ERC721 raffle
            await USDT.connect(user2).approve(raffleFi.address, ticketPriceUSDT.mul(10))
            await raffleFi.connect(user2).buyRaffleTicket(1, 10, [])

            // buy tickets for ERC20 raffle
            await USDC.connect(user2).approve(raffleFi.address, ticketPriceUSDC.mul(5))
            await raffleFi.connect(user2).buyRaffleTicket(2, 5, [])

            // approve LINK for VRF
            await LINKContract.connect(user1).approve(raffleFi.address, constants.MaxUint256)
        })
        it("should allow the winner to claim the prize for an ERC721 raffle", async () => {
            if (network.config.chainId !== 5) { return }
        })
        it("should allow the winner to claim the prize for an ERC20 raffle", async () => {
            if (network.config.chainId !== 5) { return }
        })
        it("should prevent users from claiming the prize if the raffle is not completed", async () => {
            await expect(raffleFi.connect(user1).claimRaffle(1))
            .to.be.revertedWithCustomError(raffleFi, "RaffleNotCompleted")
        })
        it("should prevent to claim a non existent raffle", async () => {
            await expect(raffleFi.connect(user1).claimRaffle(3))
            .to.be.revertedWithCustomError(raffleFi, "RaffleDoesNotExist")
        })
        it("should prevent users from claiming the prize if they are not the winner", async () => {
            if (network.config.chainId !== 5) { return }
        })
        it("should emit an event when claiming the prize", async () => {
            if (network.config.chainId !== 5) { return }
        })
    })

    describe("View", () => {
        const ticketPriceUSDT = utils.parseUnits("1", 18)
        const ticketPriceUSDC = utils.parseUnits("1", 6)
        const numOfTickets = 10
        beforeEach(async () => {
            // raffle 1 ERC721
            await erc721_1.connect(user1).approve(raffleFi.address, 1)
            await raffleFi.createERC721Raffle(
                erc721_1.address,
                1,
                USDT.address,
                (await ethers.provider.getBlock("latest")).timestamp + 60 * 60 * 2,
                numOfTickets,
                ticketPriceUSDT,
                constants.HashZero
            )

            // buy tickets
            await USDT.connect(user2).approve(raffleFi.address, ticketPriceUSDT.mul(10))
            await raffleFi.connect(user2).buyRaffleTicket(1, 10, [])

            // raffle 2 ERC20
            await USDT.connect(user1).approve(raffleFi.address, ticketPriceUSDT)
            await raffleFi.createERC20Raffle(
                USDT.address,
                utils.parseUnits("1", 18),
                USDC.address,
                (await ethers.provider.getBlock("latest")).timestamp + 60 * 60 * 2,
                numOfTickets,
                ticketPriceUSDC,
                constants.HashZero
            )
        })
        it("getRaffleDetails should return the correct RaffleData", async () => {
            const raffle = await raffleFi.getRaffleDetails(1)
            expect(raffle.raffleOwner).to.be.eq(user1Address)
            expect(raffle.assetContract).to.be.eq(erc721_1.address)
            expect(raffle.numberOfTickets).to.be.eq(numOfTickets)
            expect(raffle.raffleType.toString()).to.be.eq('0')
            expect(raffle.ticketsSold).to.be.eq(10)
            const raffleUSDC = await raffleFi.getRaffleDetails(2)
            expect(raffleUSDC.raffleOwner).to.be.eq(user1Address)
            expect(raffleUSDC.assetContract).to.be.eq(USDT.address)
            expect(raffleUSDC.numberOfTickets.toString()).to.be.eq(numOfTickets.toString())
            expect(raffleUSDC.raffleType.toString()).to.be.eq('1')
            expect(raffleUSDC.ticketsSold).to.be.eq(0)
        })
        it("getRaffleDetails should throw for non existent raffle", async () => {
            await expect(raffleFi.getRaffleDetails(100)).to.be.revertedWithCustomError(raffleFi, "RaffleDoesNotExist")
        })
        it("getTicketOwner should return the correct ticket owner", async () => {
            const ticketOwner = await raffleFi.getTicketOwner(1, 0)
            expect(ticketOwner).to.be.eq(user2Address)
        })
        it("getTicketOwner should throw for non existent ticket", async () => {
            // unexistent ticket
            await expect(raffleFi.getTicketOwner(1, 100)).to.be.revertedWithCustomError(raffleFi, "TicketDoesNotExist")
        })
        it("getTicketOwner should throw for non existent raffle", async () => {
            // unexistent raffle
            await expect(raffleFi.getTicketOwner(100, 100)).to.be.revertedWithCustomError(raffleFi, "RaffleDoesNotExist")
        })
        it("getRaffleState should return the correct raffle state", async () => {
            expect((await raffleFi.getRaffleState(1)).toString()).to.be.eq("0") // IN_PROGRESS
        })
        it("getRaffleState should throw for non existent raffle", async () => {
            await expect(raffleFi.getRaffleState(100)).to.be.revertedWithCustomError(raffleFi, "RaffleDoesNotExist")
        })
    })
});

