// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {ERC721} from "solmate/src/tokens/ERC721.sol";

contract MockERC721 is ERC721 {

    uint256 public tokenId;

    constructor(string memory _name, string memory _symbol) ERC721(_name, _symbol) {}

    function tokenURI(uint256) public pure virtual override returns (string memory) {}

    function mint(address to) public virtual {
        _mint(to, ++tokenId);
    }

    function safeMint(address to) public virtual {
        _safeMint(to, ++tokenId);
    }

    function safeMint(
        address to,
        bytes memory data
    ) public virtual {
        _safeMint(to, ++tokenId, data);
    }
}
