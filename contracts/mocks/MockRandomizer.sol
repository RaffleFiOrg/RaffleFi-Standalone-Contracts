// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.17;

interface IRaffleFi {
    function randomizerCallback(uint256 requestId, bytes32 random) external;
}

contract MockRandomizer {

    uint256 public requestId;
    function estimateFee(uint256 callbackGasLimit, uint256 requestConfirmation) external pure returns(uint256) {
        return 1;
    }

    function request(uint256 callbackGasLimit, uint256 requestConfirmation) external returns (uint256) {
        return ++requestId;
    }

    function sendRandomNumber(address contractAddress) external {
        uint256 num = 15;
        bytes32 random = bytes32(abi.encodePacked(num));
        IRaffleFi(contractAddress).randomizerCallback(requestId, random); 
        // (bool res, ) = contractAddress.call(abi.encodeWithSignature("randomizerCallback(uint256, bytes32)", requestId, random));
        // require(res, "MockRandomizer: failed to send random number");
    }
}