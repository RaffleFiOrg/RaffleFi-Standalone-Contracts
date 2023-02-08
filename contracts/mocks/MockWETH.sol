// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

contract MockWETH {

    string public name;
    string public symbol;

    uint256 public constant decimals = 18;

    uint256 public totalBalance;
    mapping(address => uint256) public balances;

    event Deposit(uint256 amount, address depositor);
    event Withdraw(uint256 amount, address withdrawer);
    event Transfer(address receiver, uint256 amount);

    error UserBalanceTooLow();
    error BalanceTooLow();
    error WithdrawFailed();

    constructor (string memory _name, string memory _symbol) payable {
        name = _name;
        symbol = _symbol;
    }

    function deposit() external payable {
        // cannot realistically overflow
        unchecked {
            totalBalance += msg.value;
            balances[msg.sender] += msg.value;
        }

        emit Deposit(msg.value, msg.sender);
    }

    function withdraw(uint256 amount) external {
        if (balances[msg.sender] < amount) revert UserBalanceTooLow();
        if (address(this).balance < amount) revert BalanceTooLow();

        // we are checking above that we have enough
        unchecked {
            balances[msg.sender] -= amount;
            // cannot overflow as this grows with every deposit
            totalBalance -= amount;
        }

        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert WithdrawFailed();
    } 

    function transfer(address to, uint256 amount) external {
        if (balances[msg.sender] < amount) revert UserBalanceTooLow();

        // cannot overflow/underflow
        unchecked {
            balances[msg.sender] -= amount;
            balances[to] += amount;
        }

        emit Transfer(to, amount);
    }
}