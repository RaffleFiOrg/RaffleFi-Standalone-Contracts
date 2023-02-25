// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.17;

interface IRaffleFi {
    function randomizerCallback(uint256 requestId, bytes32 random) external;
}

contract MockRandomizer {

    uint256 public requestId;

    mapping(address => uint256) public clientDeposits;

    function estimateFee(uint256 callbackGasLimit, uint256 requestConfirmation) external pure returns(uint256) {
        return 1;
    }

    function request(uint256 callbackGasLimit, uint256 requestConfirmation) external returns (uint256) {
        return ++requestId;
    }

    function clientDeposit(address who) external payable {
        clientDeposits[who] += msg.value;
    }

    function sendRandomNumber(address contractAddress) external {
        uint256 num = 15;
        bytes32 random = bytes32(abi.encodePacked(num));
        IRaffleFi(contractAddress).randomizerCallback(requestId, random); 
    }
}