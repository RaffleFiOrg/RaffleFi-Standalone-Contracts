// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

import {ERC20} from "solmate/src/tokens/ERC20.sol";

contract MockERC20Fee is ERC20 {

    uint256 private constant FEE_DENOMINATOR = 10000;
    uint256 private constant FEE = 250;

    address private immutable ownerWallet;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) ERC20(_name, _symbol, _decimals) {
        ownerWallet = msg.sender;
    }

    function mint(address to, uint256 value) public virtual {
        _mint(to, value);
    }

    function burn(address from, uint256 value) public virtual {
        _burn(from, value);
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        uint256 fee = (amount * FEE) / FEE_DENOMINATOR;
        uint256 amountAfterFee = amount - fee;
        super.transferFrom(from, to, amountAfterFee);
        super.transferFrom(from, ownerWallet, fee);
        return true;
    }
}
