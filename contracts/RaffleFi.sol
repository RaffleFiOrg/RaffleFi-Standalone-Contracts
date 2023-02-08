// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {SafeTransferLib} from "solmate/src/utils/SafeTransferLib.sol";
import {MerkleProofLib} from "solmate/src/utils/MerkleProofLib.sol";
import {VRFV2WrapperConsumerBase} from "@chainlink/contracts/src/v0.8/VRFV2WrapperConsumerBase.sol";
import {ERC20} from "solmate/src/tokens/ERC20.sol";
import {IERC721} from "./interfaces/IERC721.sol";
import {IWETH} from "./interfaces/IWETH9.sol";

/// @title RaffleFi
/// @author unt4x3d && ctrlc03
/// @notice RaffleFi main contract
contract RaffleFi is VRFV2WrapperConsumerBase {
    using SafeTransferLib for ERC20;

    enum RaffleState {
        IN_PROGRESS,
        FINISHED,
        COMPLETED,
        REFUNDED,
        CLAIMED
    }

    enum RaffleType {
        ERC721,
        ERC20
    }

    /// @notice definition of a Raffle
    struct RaffleData {
        address assetContract;
        address raffleOwner;
        address raffleWinner;
        RaffleState raffleState;
        RaffleType raffleType;
        address currency;
        bytes32 MerkleRoot;
        uint128 nftIdOrAmount;
        uint128 pricePerTicket;
        uint64 endTimestamp;
        uint64 numberOfTickets;
        uint64 ticketsSold;
    }

    /// @notice definition of an order
    struct Order {
        address owner;
        address currency;
        uint128 price;
    }

    /// @notice raffleID => RaffleData
    mapping(uint256 => RaffleData) public raffles;
    /// @notice raffleID => ticketId => ticketOwner
    mapping(uint256 => mapping(uint256 => address)) public raffleTickets;

    /// @notice ChainlinkRequest => raffleID
    mapping(uint256 => uint256) private vrfRequestToRaffleID;

    /// @notice Number of raffles created so far
    uint256 public raffleCounter;

    /// @notice WETH address
    IWETH public immutable WETH;

    /// @notice we enfoce a minimum number of tickets for each raffle 
    /// otherwise this might as well just be an exchange 
    uint8 public constant MINIUM_NUMBER_OF_TICKETS = 2;
    /// @notice number of random numbers per request
    uint8 public immutable numberOfWords;
    /// @notice number of confirmations for VRF request
    uint8 public immutable requestConfirmations;
    /// @notice we enforce a minimum duration for the raffle of 1 hour
    uint16 public constant MINIMUM_RAFFLE_DURATION = 1 hours;
    /// @notice callback gas limit for VRF request
    uint32 public immutable callbackGasLimit;
    /// @notice LINK Fee for VRF request
    uint64 public immutable linkFee;

    /// custom errors 
    error NotYourRaffle();
    error RaffleNotInProgress();
    error InvalidEndDate();
    error NotEnoughTickets();
    error CurrencyNotAllowed();
    error InvalidMinNumberOfTickets();
    error NotYourAsset();
    error NotEnoughTokens();
    error NFTNotTransferred();
    error ERC20NotTransferred();
    error TicketsSoldOut();
    error NotEnoughTicketsAvailable();
    error RaffleDoesNotExist();
    error RaffleEnded();
    error RaffleNotEnded();
    error RaffleNotCompleted();
    error NotTicketOwner();
    error RaffleCannotBeRefunded();
    error NotEnoughEther();
    error TicketDoesNotExist();
    error UserNotWhitelisted();
    error RaffleAlreadyCompleted();

    /// events 
    event NewRaffleCreated(uint256 raffleId);
    event RaffleCancelled(uint256 raffleId);
    event ERC20CurrencyAdded(address currency);
    event ERC20CurrencyRemoved(address currency);
    event RaffleStateChanged(
        uint256 raffleId, 
        RaffleState oldRaffleState, 
        RaffleState newRaffleState
    );
    event NewRaffleTicketBought(
        uint256 raffleId, 
        address buyer, 
        uint64 numberOfTickets, 
        uint256 initTicketId, 
        uint256 endTicketId
    );
    event VRFRequest(uint256 requestId);
    event ProtocolFeeUpdated(uint256 oldFee, uint256 newFee);
    event RaffleTicketContractSet(address newRaffleTicketContract);

    /// @notice constructor
    /// @param _weth <address> Address of the WETH contract
    /// @param _link <address> Address of the LINK token
    /// @param _wrapper <address> Address of the Chainlink VRF Wrapper
    /// @param _numOfWords <uint8> Number of random numbers per request
    /// @param _callbackGasLimit <uint32> Callback gas limit for VRF request
    /// @param _requestConfirmations <uint8> Number of confirmations for VRF request
    /// @param _linkFee <uint64> LINK Fee for VRF request
    constructor(
        address _weth,
        address _link,
        address _wrapper,
        uint8 _numOfWords,
        uint32 _callbackGasLimit,
        uint8 _requestConfirmations,
        uint64 _linkFee
    ) payable VRFV2WrapperConsumerBase(_link, _wrapper) {
        WETH = IWETH(_weth);
        numberOfWords = _numOfWords;
        callbackGasLimit = _callbackGasLimit;
        requestConfirmations = _requestConfirmations;
        linkFee = _linkFee;
    }

    /// @notice Create a new ERC721 raffle
    /// @param assetContract <address> Address of the ERC721 contract
    /// @param nftIdOrAmount <uint256> ID of the NFT to be raffled
    /// @param currency <address> Address of the currency to be used for tickets
    /// @param endTimestamp <uint256> Timestamp when the raffle will end
    /// @param numberOfTickets <uint256> Total number of tickets to be sold
    /// @param pricePerTicket <uint256> Price per ticket in wei
    /// @param MerkleRoot <bytes32> Merkle root of the allowed addresses
    /// @return _raffleId <uint256> ID of the new raffle
    function createERC721Raffle(
        address assetContract,
        uint256 nftIdOrAmount,
        address currency,
        uint256 endTimestamp,
        uint256 numberOfTickets,
        uint256 pricePerTicket,
        bytes32 MerkleRoot
    ) external returns (uint256 _raffleId) {
        // the raffle must last at least 1 hour
        if (endTimestamp <= block.timestamp + MINIMUM_RAFFLE_DURATION) revert InvalidEndDate();
        // the creator must own the NFT
        if (IERC721(assetContract).ownerOf(nftIdOrAmount) != msg.sender) revert NotYourAsset();
        // at least 2 tickets
        if (numberOfTickets < MINIUM_NUMBER_OF_TICKETS) revert NotEnoughTickets();
        
        // store the raffle data
        unchecked {
            _raffleId = ++raffleCounter;
            raffles[_raffleId] = RaffleData({
                assetContract: assetContract,
                raffleOwner: msg.sender,
                raffleWinner: address(0),
                raffleState: RaffleState.IN_PROGRESS,
                raffleType: RaffleType.ERC721,
                nftIdOrAmount: uint128(nftIdOrAmount),
                currency: currency,
                pricePerTicket: uint128(pricePerTicket),
                MerkleRoot: MerkleRoot,
                endTimestamp: uint64(endTimestamp),
                numberOfTickets: uint64(numberOfTickets),
                ticketsSold: 0
            });

            emit NewRaffleCreated(_raffleId);

            // transfer NFT 
            IERC721(assetContract).transferFrom(msg.sender, address(this), nftIdOrAmount);
            // make sure that the NFT was transferred
            if (IERC721(assetContract).ownerOf(nftIdOrAmount) != address(this)) revert NFTNotTransferred();
        }
    }

    /// @notice Create a new ERC20 raffle
    /// @param assetContract <address> Address of the ERC20 contract
    /// @param nftIdOrAmount <uint256> Amount of tokens to be raffled
    /// @param currency <address> Address of the currency to be used for tickets
    /// @param endTimestamp <uint256> Timestamp when the raffle will end
    /// @param numberOfTickets <uint256> Total number of tickets to be sold
    /// @param pricePerTicket <uint256> Price per ticket in wei
    /// @param MerkleRoot <bytes32> Merkle root of the allowed addresses
    /// @return _raffleId <uint256> ID of the new raffle
    function createERC20Raffle(
        address assetContract,
        uint256 nftIdOrAmount,
        address currency,
        uint256 endTimestamp,
        uint256 numberOfTickets,
        uint256 pricePerTicket,
        bytes32 MerkleRoot
    ) external payable returns (uint256 _raffleId) {
        // raffle must last at least 1 hour
        if (endTimestamp <= block.timestamp + MINIMUM_RAFFLE_DURATION) revert InvalidEndDate();
        // if creating a raffle using Ether as the asset raffled
        if (assetContract == address(0)) {
            // we need to check that msg.value == nftIdOrAmount
            if (msg.value != nftIdOrAmount) revert NotEnoughEther();
        } else {
            // we want to make sure that the user has enough tokens
            if (ERC20(assetContract).balanceOf(msg.sender) < nftIdOrAmount) revert NotEnoughTokens();
        }
        // at least 2 tickets per raffle 
        if (numberOfTickets < MINIUM_NUMBER_OF_TICKETS) revert NotEnoughTickets();
        
        unchecked {
            _raffleId = ++raffleCounter;
            raffles[_raffleId] = RaffleData({
                assetContract: assetContract,
                raffleOwner: msg.sender,
                raffleWinner: address(0),
                raffleState: RaffleState.IN_PROGRESS,
                raffleType: RaffleType.ERC20,
                nftIdOrAmount: uint128(nftIdOrAmount),
                currency: currency,
                pricePerTicket: uint128(pricePerTicket),
                MerkleRoot: MerkleRoot,
                endTimestamp: uint64(endTimestamp),
                numberOfTickets: uint64(numberOfTickets),
                ticketsSold: 0
            });
            
            emit NewRaffleCreated(_raffleId);
        }   
        
        // take money if not ether 
        if (assetContract != address(0)) {
            /// @notice here we make sure deflationary tokens are not accepted
            // check balance before and after
            uint256 balanceBefore = ERC20(assetContract).balanceOf(address(this));
            ERC20(assetContract).safeTransferFrom(msg.sender, address(this), nftIdOrAmount);
            uint256 balanceAfter = ERC20(assetContract).balanceOf(address(this));
            // double check we received the assets
            if(balanceBefore + nftIdOrAmount != balanceAfter) revert ERC20NotTransferred();
        }
    }
    
    /// @notice Allows raffle owners to cancel a raffle 
    /// @param _raffleId <uint256> ID of the raffle to be cancelled
    function cancelRaffle(uint256 _raffleId) external {
        RaffleData memory raffleData = raffles[_raffleId];

        // cannot cancel someone else's raffle
        if (msg.sender != raffleData.raffleOwner) revert NotYourRaffle();
        // the raffle must be in progress to be cancelled
        if (raffleData.raffleState != RaffleState.IN_PROGRESS) revert RaffleNotInProgress();

        // Delete the object from storage
        delete raffles[_raffleId];
        
        // Set is as REFUNDED
        raffles[_raffleId].raffleState = RaffleState.REFUNDED;
        emit RaffleStateChanged(_raffleId, RaffleState.IN_PROGRESS, RaffleState.REFUNDED);

        // Check which type of asset 
        if (raffleData.raffleType == RaffleType.ERC721) {
            // Transfer the NFT back to the raffle owner
            IERC721(raffleData.assetContract).transferFrom(address(this), raffleData.raffleOwner, raffleData.nftIdOrAmount);
        } else if (raffleData.raffleType == RaffleType.ERC20) {
            // Transfer the amount back to the raffle owner
            if (raffleData.assetContract == address(0)) _handleNativeTransfer(raffleData.raffleOwner, raffleData.nftIdOrAmount);
            else ERC20(raffleData.assetContract).safeTransfer(raffleData.raffleOwner, raffleData.nftIdOrAmount);
        }

        emit RaffleCancelled(_raffleId);
    }

    /// @notice Allows users to buy tickets for a raffle
    /// @param _raffleId <uint256> The ID of the raffle the user wants to buy a ticket for
    /// @param _numberOfTickets <uint64> The number of tickets a user wants to buy
    /// @param _merkleProof <bytes32[]> MerkleProof used to verify user is part of the whitelist
    function buyRaffleTicket(uint256 _raffleId, uint64 _numberOfTickets, bytes32[] calldata _merkleProof) external payable {
        RaffleData memory raffleData = raffles[_raffleId];

        // check if the raffle exists
        if (raffleData.raffleOwner == address(0)) revert RaffleDoesNotExist();
        // check that the raffle has not ended yet
        if (block.timestamp > raffleData.endTimestamp) revert RaffleEnded();
        // the raffle must be in progress
        if (raffleData.raffleState != RaffleState.IN_PROGRESS) revert RaffleNotInProgress();
        // check that the raffle is not sold out yet
        if (raffleData.ticketsSold == raffleData.numberOfTickets) revert TicketsSoldOut();
        // check that the user is not buying more tickets than available
        if (raffleData.ticketsSold + _numberOfTickets > raffleData.numberOfTickets) revert NotEnoughTicketsAvailable();
        // if the raffle is using Ether as the currency, check that the user sent enough
        if (raffleData.currency == address(0)) if (msg.value != raffleData.pricePerTicket * _numberOfTickets) revert NotEnoughEther();

        // if the raffle has a whitelist, verify the user is part of it
        if(raffleData.MerkleRoot != bytes32(0)){
            bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
            if (!MerkleProofLib.verify(_merkleProof, raffleData.MerkleRoot, leaf)) revert UserNotWhitelisted();
        }

        // increase amount of tickets sold
        raffles[_raffleId].ticketsSold += _numberOfTickets;
      
        // Assign the tickets to the buyer
        uint256 initTicketId = raffleData.ticketsSold;
        uint256 endTicketId = initTicketId + _numberOfTickets - 1;
        _assignTicketToUser(msg.sender, _raffleId, initTicketId, endTicketId);

        emit NewRaffleTicketBought(_raffleId, msg.sender, _numberOfTickets, initTicketId, endTicketId);

        uint256 amountToPay = _numberOfTickets * raffleData.pricePerTicket;
        // Handle the payment if not eth
        if (raffleData.currency != address(0)) {
            /// @notice make sure we do not accept fee on transfer tokens
            /// as this might cause a problem later when paying out the raffle owner -> txs would revert with insufficient funds
            uint256 balanceBefore = ERC20(raffleData.currency).balanceOf(address(this));
            ERC20(raffleData.currency).safeTransferFrom(msg.sender, address(this), amountToPay);
            uint256 balanceAfter = ERC20(raffleData.currency).balanceOf(address(this));
            // double check we received the full amount
            if(balanceBefore + amountToPay != balanceAfter) revert ERC20NotTransferred();
        }
    }

    /// @notice Allows users to complete a Raffle. The winner of the raffle will receive the asset.
    /// @param _raffleId <uint256> The ID of the raffle the user wants to buy a ticket for
    function completeRaffle(uint256 _raffleId) external {
        RaffleData memory raffleData = raffles[_raffleId];
        if (raffleData.raffleOwner == address(0)) revert RaffleDoesNotExist();
        if (raffleData.raffleState != RaffleState.IN_PROGRESS) revert RaffleNotInProgress();
      
        // we can complete if we sold all tickets or if the raffle deadline has passed
        if (raffleData.ticketsSold != raffleData.numberOfTickets) {
            if (block.timestamp < raffleData.endTimestamp) revert RaffleNotEnded();
        }

        // In this case we must refund all the ticket buyers
        if (raffleData.ticketsSold < raffleData.numberOfTickets) {
            // Send the asset(s) back to the raffleOwner
            if (raffleData.raffleType == RaffleType.ERC721) {
                IERC721(
                    raffleData.assetContract
                ).transferFrom(
                    address(this), 
                    raffleData.raffleOwner, 
                    raffleData.nftIdOrAmount
                );
            }
            if (raffleData.raffleType == RaffleType.ERC20) {
                ERC20(raffleData.currency).safeTransfer(
                    raffleData.raffleOwner, 
                    raffleData.nftIdOrAmount
                );
            }
            // set state to refunded
            raffles[_raffleId].raffleState = RaffleState.REFUNDED;
            emit RaffleStateChanged(_raffleId, RaffleState.IN_PROGRESS, RaffleState.REFUNDED);
        } else {
            // we need to take the payment for the LINK fee
            // we trust LINK so we can use transferFrom
            LINK.transferFrom(msg.sender, address(this), linkFee);
            /// @notice we assign 0.5% of the tickets to whoever calls this function and pays the LINK fee
            // 1. calculate the number of tickets
            uint256 ticketsToCaller = raffleData.numberOfTickets * 50 / 10000;
            /// if zero -> give at least 1 ticket
            _assignTicketToUser(
                msg.sender, 
                _raffleId, 
                raffleData.ticketsSold, 
                ticketsToCaller != 0 ? raffleData.ticketsSold + ticketsToCaller - 1 : raffleData.ticketsSold
            );

            /// @notice This will mark the raffle State as FINISHED. Can only be called once.
            uint256 vrfRequestId = _requestRandomness(_raffleId);
            vrfRequestToRaffleID[vrfRequestId] = _raffleId;

            emit VRFRequest(vrfRequestId);
        }
    }

    /// @notice Allows users to claim the raffle. Owner of the raffle will receive the payment and the winner his asset
    /// @param _raffleId <uint256> The ID of the raffle the user wants to buy a ticket for
    function claimRaffle(uint256 _raffleId) external {
        RaffleData storage raffleData = raffles[_raffleId];
        if (raffleData.raffleOwner == address(0)) revert RaffleDoesNotExist();
        if (raffleData.raffleState != RaffleState.COMPLETED) revert RaffleNotCompleted();

        // set state to claimed so it cannot be claimed again 
        raffleData.raffleState = RaffleState.CLAIMED;
        emit RaffleStateChanged(_raffleId, RaffleState.COMPLETED, RaffleState.CLAIMED);

        address raffleOwner = raffleData.raffleOwner;
        address winner = raffleData.raffleWinner;

        // Sending the asset/s to the winner
        if (raffleData.raffleType == RaffleType.ERC721){
            IERC721(raffleData.assetContract).transferFrom(address(this), winner, raffleData.nftIdOrAmount);
        } else if (raffleData.raffleType == RaffleType.ERC20){
            ERC20(raffleData.currency).safeTransfer(winner, raffleData.nftIdOrAmount);
        }

        uint256 totalAmountEarned = raffleData.ticketsSold * raffleData.pricePerTicket;
        address raffleCurrency = raffleData.currency;

        // Payments to the raffle owner
        ERC20(raffleCurrency).safeTransfer(raffleOwner, totalAmountEarned);
    }


    /// @notice Allows users to claim a cancelled raffle where they will receive their initially payment
    /// @param _raffleId <uint256> The ID of the raffle the user wants to buy a ticket for
    /// @param ticketIds <uint256[]> Array of ticketIds to claim
    function claimCancelledRaffle(
        uint256 _raffleId, 
        uint256[] calldata ticketIds
    ) external {
        RaffleData memory raffleData = raffles[_raffleId];
        // check that the raffle is in refunded state
        if (raffleData.raffleState != RaffleState.REFUNDED) revert RaffleCannotBeRefunded();

        // cache length 
        uint256 len = ticketIds.length;
        for(uint i; i < len;){
            if (raffleTickets[_raffleId][ticketIds[i]] != msg.sender) revert NotTicketOwner();
            // reset ticket owner to zero so it cannot be claimed again
            raffleTickets[_raffleId][ticketIds[i]] = address(0);
            unchecked {
                i++;
            }
        }
        // calculate amount to refund
        uint256 totalRefund = len * raffleData.pricePerTicket;
        // refund the user
        ERC20(raffleData.currency).safeTransfer(msg.sender, totalRefund);
    }

    /** ############################################################################################
     *              INTERNAL/PRIVATE FUNCTIONS
     *  ############################################################################################
     */

    /// @notice Requests randomness to ChainLink VRF
    /// @param _raffleId <uint256> The ID of the raffle
    /// @return requestId <uint256> The ID of the VRF request
    function _requestRandomness(uint256 _raffleId) internal returns (uint256 requestId) {
        RaffleData storage raffleData = raffles[_raffleId];
        raffleData.raffleState = RaffleState.FINISHED;
        emit RaffleStateChanged(_raffleId, RaffleState.IN_PROGRESS, RaffleState.FINISHED);
        requestId = requestRandomness(
            callbackGasLimit,
            requestConfirmations,
            numberOfWords
        );
    }

    /// @notice Callback function used by VRF Coordinator
    /// @notice This function is called by the VRF Coordinator when the VRF
    /// @notice output is ready to be consumed.
    /// @param _requestId <uint256> The ID of the VRF request
    /// @param _randomWords <uint256[]> The VRF output
    function fulfillRandomWords(uint256 _requestId, uint256[] memory _randomWords) internal override {
        uint256 raffleId = vrfRequestToRaffleID[_requestId];
        RaffleData storage raffleData = raffles[raffleId];
        /// should not happen but what if VRF calls back twice?
        if (raffleData.raffleState == RaffleState.COMPLETED) revert RaffleAlreadyCompleted();
        raffleData.raffleState = RaffleState.COMPLETED;
        emit RaffleStateChanged(raffleId, RaffleState.FINISHED, RaffleState.COMPLETED);
        // Picking up the winner
        uint256 winningIndex = uint256(_randomWords[0]) % raffleData.ticketsSold;
        raffleData.raffleWinner = raffleTickets[raffleId][winningIndex];
    }

    /// @notice Handle native transfers
    /// @param _dest <address> The destination address
    /// @param _amount <uint256> The amount to transfer
    function _handleNativeTransfer(address _dest, uint256 _amount) internal {
        // Handle Ether payment
        if (address(this).balance< _amount) revert NotEnoughEther();
        uint256 gas =  gasleft();
        (bool success, ) = _dest.call{value: _amount, gas: gas}("");
        // If the Ether transfer fails, wrap the Ether and try to send it as WETH.
        if (!success) {
            WETH.deposit{value: _amount}();
            ERC20(address(WETH)).safeTransfer(_dest, _amount);
        }
    }

    /// @notice set the tickets to its owner
    /// @param user <address> The user to assign the tickets to
    /// @param _raffleId <uint256> The raffle ID
    /// @param initTicketId <uint256> The first ticket ID
    /// @param endTicketId <uint256> The last ticket ID
    function _assignTicketToUser(address user, uint256 _raffleId, uint256 initTicketId, uint256 endTicketId) internal {
        for (uint256 i = initTicketId; i <= endTicketId;){
            raffleTickets[_raffleId][i] = user;
            unchecked {
                ++i;
            }
        }
    }

    /** ############################################################################################
     *                 VIEW FUNCTIONS
     *  ############################################################################################
     */

    /// @notice Returns the raffle details
    /// @param _raffleId <uint256> The ID of the raffle
    /// @return <RaffleData> The raffle details
    function getRaffleDetails(uint256 _raffleId) external view returns(RaffleData memory) {
        if (_raffleId > raffleCounter) revert RaffleDoesNotExist();
        return(raffles[_raffleId]);
    }

    /// @notice Returns the raffle state
    /// @param _raffleId <uint256> The ID of the raffle
    /// @return <RaffleState> The raffle state
    function getRaffleState(uint256 _raffleId) external view returns(RaffleState) {
        if (_raffleId > raffleCounter) revert RaffleDoesNotExist();
        return(raffles[_raffleId].raffleState);
    }

    /// @notice Returns a ticket's owner
    /// @param _raffleId <uint256> The ID of the raffle
    /// @param _ticketId <uint256> The ID of the ticket
    /// @return owner <address> The ticket owner
    function getTicketOwner(uint256 _raffleId, uint256 _ticketId) external view returns(address owner) {
        owner = raffleTickets[_raffleId][_ticketId];
        if (owner == address(0)) revert TicketDoesNotExist();
    }
}
