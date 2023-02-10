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
}

contract MockBadRaffleCreator {

    IRaffleFi public immutable raffleFi;
    IERC20 public immutable link;
    uint256 public immutable linkFee;

    constructor(address _raffleFi, address _link, uint256 _linkFee) payable {
        raffleFi = IRaffleFi(_raffleFi);
        link = IERC20(_link);
        linkFee = _linkFee;
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
        link.approve(address(raffleFi), linkFee);
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
        link.approve(address(raffleFi), linkFee);
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

    receive() external payable {
        revert("MockBadRaffleCreator: cannot receive ETH");
    }
}
