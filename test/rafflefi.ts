import chai, { expect } from "chai"
import { BigNumber, Contract, ContractFactory, utils, Signer, constants } from "ethers";
import { ethers } from "hardhat";

describe("RaffleFi", function () {
    let raffleFiFactory: ContractFactory
    let raffleFi: Contract 
    let LINK: string = "0x326C977E6efc84E512bB9C30f76E30c160eD06FB"
    let WETH: Contract
    let USDT: Contract 
    let ERC20: Contract
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
        
        const ERC721Factory = await ethers.getContractFactory("MockERC721")
        erc721_1 = await ERC721Factory.deploy('ERC721_1', 'ERC721_1')
        erc721_2 = await ERC721Factory.deploy('ERC721_2', 'ERC721_2')

        raffleFiFactory = await ethers.getContractFactory("RaffleFi")
        raffleFi = await raffleFiFactory.deploy(
            WETH.address,
            LINK,
            VRFWrapper,
            1,
            100000,
            3,
            utils.parseEther("0.25")
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
    })

    describe("Cancel", () => {
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
    })

    describe("Complete", () => {
        it("should allow to complete an ERC721 raffle", async () => {})
        it("should allow to complete an ERC20 raffle", async () => {})
        it("should not allow to complete an ERC721 raffle if not all tickets were sold or deadline passed", async () => {})
        it("should not allow to complete an ERC20 raffle if not all tickets were sold or deadline passed", async () => {})
        it("should not allow to complete a raffle without paying the LINK fee for VRF", async () => {})
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
        it("should return the correct RaffleData", async () => {})
        it("should return the correct ticket owner", async () => {})
        it("should throw when the ticket does not exist", async () => {})
        it("should return the correct raffle state", async () => {})
    })
});
