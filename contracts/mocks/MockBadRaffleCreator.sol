// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.17;

import "../interfaces/IERC20.sol";
import "../interfaces/IERC721.sol";

interface IRaffleFi {
    function createERC721Raffle(
        address assetContract,
        uint256 nftIdOrAmount,
        address currency,
        uint256 endTimestamp,
        uint256 numberOfTickets,
        uint256 pricePerTicket,
        bytes32 MerkleRoot
    ) external;
    function createERC20Raffle(
        address assetContract,
        uint256 nftIdOrAmount,
        address currency,
        uint256 endTimestamp,
        uint256 numberOfTickets,
        uint256 pricePerTicket,
        bytes32 MerkleRoot
    ) external payable;
    function cancelRaffle(
        uint256 raffleId 
    ) external;
    function completeRaffle(
        uint256 raffleId,
        bool approve 
    ) external;
}

contract MockBadRaffleCreator {

    IRaffleFi public immutable raffleFi;
    IERC20 public immutable link;

    constructor(address _raffleFi, address _link) payable {
        raffleFi = IRaffleFi(_raffleFi);
        link = IERC20(_link);
    }

    function createRaffle(
        address assetContract,
        uint256 nftIdOrAmount,
        address currency,
        uint256 endTimestamp,
        uint256 numberOfTickets,
        uint256 pricePerTicket,
        bytes32 MerkleRoot
    ) external {
        IERC721(assetContract).approve(address(raffleFi), nftIdOrAmount);
        raffleFi.createERC721Raffle(
            assetContract,
            nftIdOrAmount,
            currency,
            endTimestamp,
            numberOfTickets,
            pricePerTicket,
            MerkleRoot
        );
    }

    function createERC20Raffle(
         address assetContract,
        uint256 nftIdOrAmount,
        address currency,
        uint256 endTimestamp,
        uint256 numberOfTickets,
        uint256 pricePerTicket,
        bytes32 MerkleRoot
    ) external payable {
        raffleFi.createERC20Raffle{value: msg.value}(
            assetContract,
            nftIdOrAmount,
            currency,
            endTimestamp,
            numberOfTickets,
            pricePerTicket,
            MerkleRoot
        );
    }

    function cancelRaffle(uint256 raffleId) external {
        raffleFi.cancelRaffle(raffleId);
    }

    function completeRaffle(uint256 raffleId, bool accept) external {
        link.approve(address(raffleFi), type(uint256).max);
        raffleFi.completeRaffle(raffleId, accept);
    }
    
    receive() external payable {
        revert("MockBadRaffleCreator: cannot receive ETH");
    }
}
