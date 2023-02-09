import chai, { expect } from "chai"
import { BigNumber, Contract, ContractFactory, utils, Signer, constants } from "ethers";
import { ethers } from "hardhat";

describe("RaffleFi", function () {
    let raffleFiFactory: ContractFactory
    let raffleFi: Contract 
    let LINKContract: Contract 
    let LINK: string = "0x326C977E6efc84E512bB9C30f76E30c160eD06FB"
    let WETH: Contract
    let USDT: Contract 
    let ERC20: Contract
    let FeeOnTransferToken: Contract
    let USDC: Contract
    let erc721_1: Contract
    let erc721_2: Contract

    let user1: Signer 
    let user2: Signer 
    let user3: Signer 
    let user1Address: string
    let user2Address: string
    let user3Address: string

    const VRFWrapper: string = "0x708701a1DfF4f478de54383E49a627eD4852C816"

    const LINK_FEE = utils.parseEther("0.25")

    beforeEach(async () => {
        [user1, user2, user3] = await ethers.getSigners()
        user1Address = await user1.getAddress()
        user2Address = await user2.getAddress()
        user3Address = await user3.getAddress()

        const WETHFactory = await ethers.getContractFactory("MockWETH")
        WETH = await WETHFactory.deploy('WETH', 'WETH')
        const ERC20Factory = await ethers.getContractFactory("MockERC20")
        USDT = await ERC20Factory.deploy('USDT', 'USDT', 18)
        USDC = await ERC20Factory.deploy('USDC', 'USDC', 6)
        ERC20 = await ERC20Factory.deploy('ERC20', 'ERC20', 18)
        LINKContract = await ERC20Factory.deploy('LINK', 'LINK', 18)

        const FeeOnTransferFactory = await ethers.getContractFactory("MockERC20Fee")
        FeeOnTransferToken = await FeeOnTransferFactory.deploy('FOTT', 'FOTT', 18)
        
        const ERC721Factory = await ethers.getContractFactory("MockERC721")
        erc721_1 = await ERC721Factory.deploy('ERC721_1', 'ERC721_1')
        erc721_2 = await ERC721Factory.deploy('ERC721_2', 'ERC721_2')

        raffleFiFactory = await ethers.getContractFactory("RaffleFi")
        raffleFi = await raffleFiFactory.deploy(
            WETH.address,
            LINKContract.address,
            VRFWrapper,
            1,
            100000,
            3,
            LINK_FEE
        )

        // mint a couple of NFTs 
        await erc721_1.mint(user1Address)
        await erc721_1.mint(user1Address)
        await erc721_1.mint(user2Address)
        await erc721_1.mint(user2Address)
        await erc721_1.mint(user3Address)
        await erc721_1.mint(user3Address)

        // mint some tokens
        await USDT.mint(user1Address, utils.parseUnits("1000", 18))
        await USDT.mint(user2Address, utils.parseUnits("1000", 18))
        await USDT.mint(user3Address, utils.parseUnits("1000", 18))
        await USDC.mint(user1Address, utils.parseUnits("1000", 6))
        await USDC.mint(user2Address, utils.parseUnits("1000", 6))
        await USDC.mint(user3Address, utils.parseUnits("1000", 6))
        await ERC20.mint(user1Address, utils.parseUnits("1000", 18))
        await ERC20.mint(user2Address, utils.parseUnits("1000", 18))
        await ERC20.mint(user3Address, utils.parseUnits("1000", 18))
        await FeeOnTransferToken.mint(user1Address, utils.parseUnits("1000", 18))
        await FeeOnTransferToken.mint(user2Address, utils.parseUnits("1000", 18))
        await FeeOnTransferToken.mint(user3Address, utils.parseUnits("1000", 18))
        await LINKContract.mint(user1Address, utils.parseUnits("1000", 18))
        await LINKContract.mint(user2Address, utils.parseUnits("1000", 18))
        await LINKContract.mint(user3Address, utils.parseUnits("1000", 18))
    })

    describe("Setup", async () => {
        it("should have set the correct state variables", async () => {
            expect(await raffleFi.WETH()).to.equal(WETH.address)
            expect(await raffleFi.numberOfWords()).to.equal(1)
            expect(await raffleFi.callbackGasLimit()).to.equal(100000)
            expect(await raffleFi.requestConfirmations()).to.equal(3)
            expect((await raffleFi.linkFee()).toString()).to.equal(utils.parseEther("0.25").toString())
        })
    })

    describe("Create", () => {
        it("should allow to create an ERC721 raffle", async () => {
            await LINKContract.connect(user1).approve(raffleFi.address, LINK_FEE)
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
            await LINKContract.connect(user1).approve(raffleFi.address, LINK_FEE)
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
            await LINKContract.connect(user1).approve(raffleFi.address, LINK_FEE)
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
            await LINKContract.connect(user1).approve(raffleFi.address, LINK_FEE)
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
            await LINKContract.connect(user1).approve(raffleFi.address, LINK_FEE)
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
            await LINKContract.connect(user1).approve(raffleFi.address, LINK_FEE)
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
            await LINKContract.connect(user1).approve(raffleFi.address, LINK_FEE)
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
            await LINKContract.connect(user1).approve(raffleFi.address, LINK_FEE)
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
            await LINKContract.connect(user1).approve(raffleFi.address, LINK_FEE)
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
            await LINKContract.connect(user1).approve(raffleFi.address, LINK_FEE)
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
            await LINKContract.connect(user1).approve(raffleFi.address, LINK_FEE)
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
            await LINKContract.connect(user1).approve(raffleFi.address, LINK_FEE)
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
        it("should not allow to create a ERC721 raffle without paying the LINK fee", async () => {
            await expect(raffleFi.createERC721Raffle(
                erc721_1.address,
                1,
                USDT.address,
                new Date().valueOf() + 10000,
                10,
                utils.parseUnits("1", 18),
                constants.HashZero
            )).to.be.reverted
        })
    })

    describe("Cancel", () => {
        beforeEach(async () =>  {
            // raffle 1 ERC721
            await LINKContract.connect(user1).approve(raffleFi.address, LINK_FEE)
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
            await LINKContract.connect(user1).approve(raffleFi.address, LINK_FEE)
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
        })
        it("should allow to cancel an ERC721 raffle", async () => {
            await raffleFi.connect(user1).cancelRaffle(1)
            const raffle = await raffleFi.raffles(1)
            expect(raffle.raffleState).to.be.eq(3) // REFUNDED
            expect(raffle.raffleOwner).to.be.eq(constants.AddressZero)
        })
        it("should allow to cancel an ERC20 raffle", async () => {
            await raffleFi.connect(user1).cancelRaffle(2)
            const raffle = await raffleFi.raffles(2)
            expect(raffle.raffleState).to.be.eq(3) // REFUNDED
            expect(raffle.raffleOwner).to.be.eq(constants.AddressZero)
        })
        it("should prevent cancelling a raffle that is not in the correct state", async () => {
            await raffleFi.connect(user1).cancelRaffle(1)
            await expect(raffleFi.connect(user1).cancelRaffle(1)).to.be.revertedWithCustomError(raffleFi, "NotYourRaffle")
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
            await LINKContract.approve(raffleFi.address, LINK_FEE)
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
        it("should return the LINK fee to the raffle creator", async () => {
            const linkBalanceBefore = await LINKContract.balanceOf(user1Address)
            await raffleFi.connect(user1).cancelRaffle(1)
            const linkBalanceAfter = await LINKContract.balanceOf(user1Address)
            expect(linkBalanceAfter.sub(linkBalanceBefore)).to.be.eq(LINK_FEE)
        })
    })

    describe("Buy", () => {
        const ticketPriceUSDT = utils.parseUnits("1", 18)
        const ticketPriceUSDC = utils.parseUnits("1", 6)
        const numOfTickets = 10
        beforeEach(async () =>  {
            // raffle 1 ERC721
            await LINKContract.connect(user1).approve(raffleFi.address, LINK_FEE)
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
            await LINKContract.connect(user1).approve(raffleFi.address, LINK_FEE)
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
            await LINKContract.connect(user1).approve(raffleFi.address, LINK_FEE)
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
    })

    describe("Refund", () => {
        const ticketPriceUSDT = utils.parseUnits("1", 18)
        const ticketPriceUSDC = utils.parseUnits("1", 6)
        beforeEach(async () =>  {
            // raffle 1 ERC721
            await LINKContract.connect(user1).approve(raffleFi.address, LINK_FEE)
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
            await LINKContract.connect(user1).approve(raffleFi.address, LINK_FEE)
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
    })

    describe("Complete", () => {
        const ticketPriceUSDT = utils.parseUnits("1", 18)
        const ticketPriceUSDC = utils.parseUnits("1", 6)
        beforeEach(async () => {
            
            // raffle 1 ERC721
            await LINKContract.connect(user1).approve(raffleFi.address, LINK_FEE)
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
            await LINKContract.connect(user1).approve(raffleFi.address, LINK_FEE)
            await USDT.connect(user1).approve(raffleFi.address, utils.parseUnits("1", 18))
            await raffleFi.createERC20Raffle(
                USDT.address,
                utils.parseUnits("1", 18),
                USDC.address,
                new Date().valueOf() + 10000,
                10,
                ticketPriceUSDC,
                constants.HashZero
            )

            // buy tickets for ERC721 raffle
            await USDT.connect(user2).approve(raffleFi.address, ticketPriceUSDT.mul(10))
            await raffleFi.connect(user2).buyRaffleTicket(1, 10, [])

            // buy tickets for ERC20 raffle
            await USDC.connect(user2).approve(raffleFi.address, ticketPriceUSDC.mul(10))
            await raffleFi.connect(user2).buyRaffleTicket(2, 10, [])

        })
        it("should allow to complete an ERC721 raffle", async () => {

        })
        it("should allow to complete an ERC20 raffle", async () => {})
        it("should not allow to complete an ERC721 raffle if not all tickets were sold or deadline passed", async () => {})
        it("should not allow to complete an ERC20 raffle if not all tickets were sold or deadline passed", async () => {})
        it("should emit an event when completing a raffle", async () => {})
    })

    describe("Claim", () => {
        it("should allow the winner to claim the prize for an ERC721 raffle", async () => {})
        it("should allow the winner to claim the prize for an ERC20 raffle", async () => {})
        it("should prevent users from claiming the prize if the raffle is not completed", async () => {})
        it("should prevent users from claiming the prize if they are not the winner", async () => {})
        it("should emit an event when claiming the prize", async () => {})
    })

    describe("View", () => {
        const ticketPriceUSDT = utils.parseUnits("1", 18)
        const ticketPriceUSDC = utils.parseUnits("1", 6)
        const numOfTickets = 10
        beforeEach(async () => {
            // raffle 1 ERC721
            await LINKContract.approve(raffleFi.address, LINK_FEE)
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

            // buy tickets
            await USDT.connect(user2).approve(raffleFi.address, ticketPriceUSDT.mul(10))
            await raffleFi.connect(user2).buyRaffleTicket(1, 10, [])

            // raffle 2 ERC20
            await LINKContract.approve(raffleFi.address, LINK_FEE)
            await USDT.connect(user1).approve(raffleFi.address, ticketPriceUSDT)
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
