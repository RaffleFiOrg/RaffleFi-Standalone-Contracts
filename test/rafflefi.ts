import { expect } from "chai";
import { Contract, ContractFactory } from "ethers";
import { ethers } from "hardhat";

describe("RaffleFi", function () {

    let raffleFiFactory: ContractFactory
    let raffleFi: Contract 

    this.beforeAll(async () => {
        raffleFiFactory = await ethers.getContractFactory("RaffleFi");
    })

    describe("Setup", async () => {
        it("should have set the correct state variables", async () => {})
    })

    describe("Create", () => {
        it("should allow to create an ERC721 raffle", async () => {})
        it("should allow to create an ERC20 raffle", async () => {})
        it("should not allow to create an ERC721 raffle with 0 tickets", async () => {})
        it("should not allow to create an ERC20 raffle with 0 tickets", async () => {})
        it("should not allow to create an ERC721 for a non existent token", async () => {})
        it("should not allow to create an ERC721 raffle for a token that is not owned by the caller", async () => {})
        it("should not allow to create an ERC20 raffle for a quantity greater than the caller's balance", async () => {})
        it("should allow to create a raffle with a whitelist", async () => {})
        it("should emit an event when creating a raffle", async () => {})
    })

    describe("Cancel", () => {
        it("should allow to cancel an ERC721 raffle", async () => {})
        it("should allow to cancel an ERC20 raffle", async () => {})
        it("should prevent cancelling a raffle that is not in the correct state", async () => {})
        it("should emit an event when cancelling a raffle", async () => {})
        it("should prevent cancelling someone else's raffle", async () => {})
    })

    describe("Buy", () => {
        it("should allow to buy a ticket for an ERC721 raffle", async () => {})
        it("should allow to buy a ticket for an ERC20 raffle", async () => {})
        it("should allow to buy multiple tickets for an ERC721 raffle", async () => {})
        it("should allow to buy multiple tickets for an ERC20 raffle", async () => {})
        it("should not allow to buy more tickets than the available ones", async () => {})
        it("should emit an event when buying a ticket", async () => {})
    })

    describe("Refund", () => {
        it("should allow to refund a ticket for an ERC721 raffle if cancelled", async () => {})
        it("should allow to refund a ticket for an ERC20 raffle if cancelled", async () => {})
        it("should not refund if no tickets were bought", async () => {})
        it("should not refund someone else's ticket", async () => {})
        it("should emit an event when refunding a ticket", async () => {})
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
