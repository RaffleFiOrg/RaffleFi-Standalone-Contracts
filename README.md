# RaffleFi

![CI](https://github.com/RaffleFiOrg/RaffleFi-Standalone-Contracts/actions/workflows/contracts.yml/badge.svg)

```
 ██▀███   ▄▄▄        █████▒ █████▒██▓    ▓█████   █████▒██▓
▓██ ▒ ██▒▒████▄    ▓██   ▒▓██   ▒▓██▒    ▓█   ▀ ▓██   ▒▓██▒
▓██ ░▄█ ▒▒██  ▀█▄  ▒████ ░▒████ ░▒██░    ▒███   ▒████ ░▒██▒
▒██▀▀█▄  ░██▄▄▄▄██ ░▓█▒  ░░▓█▒  ░▒██░    ▒▓█  ▄ ░▓█▒  ░░██░
░██▓ ▒██▒ ▓█   ▓██▒░▒█░   ░▒█░   ░██████▒░▒████▒░▒█░   ░██░
░ ▒▓ ░▒▓░ ▒▒   ▓▒█░ ▒ ░    ▒ ░   ░ ▒░▓  ░░░ ▒░ ░ ▒ ░   ░▓  
  ░▒ ░ ▒░  ▒   ▒▒ ░ ░      ░     ░ ░ ▒  ░ ░ ░  ░ ░      ▒ ░
  ░░   ░   ░   ▒    ░ ░    ░ ░     ░ ░      ░    ░ ░    ▒ ░
   ░           ░  ░                  ░  ░   ░  ░        ░  
```

RaffleFi is a protocol that can be used to create on chain raffles. 

A seller can decide on their raffle options such as:

* ERC721 or ERC20/Ether/Native asset to raffle (address and quantity/tokenID)
* number of tickets to sell
* price of the ticket
* duration of the raffle (> 1 hour)
* Merkle root - used to create private raffles
* currency for ticket payment

Buyers can buy tickets up until the deadline of the raffle, or until tickets are sold out. The seller can cancel the raffle at any time to regain control of their assets (whether this is a ERC20/Ether or an ERC721 token). Buyers will be able to claim a refund on their tickets, but unfortunately gas fees will be lost. Furthermore ticket holders can sell tickets to other users should they wish to. 

NOTE: if tickets are not sold out, a seller can decide to go ahead with a raffle anyways.

NOTE (2): use at discretion. You will lose gas fees (but not your ticket money) if a seller decides to cancel a raffle. 

NOTE (3): we decided to allow a seller to cancel a raffle until the a winner is extracted. At this point, they will not be able to cancel anymore. This is due to there possibly being a error in the VRF request, and the assets being stuck in the contract. Please note that sellers will lose the LINK fee this way as the VRF request is not refundable.

## Installation

1. clone the repo: `git clone https://github.com/RaffleFiOrg/RaffleFi-Standalone-Contracts.git`
2. install deps: `yarn`

## Test

Running tests will require a forked environment, as well as a live one for VRF tests. You will need to copy `.env-template` to `.env` and fill it:

```bash
RPC_URL_GOERLI=""
GOERLI_LINK="0x326C977E6efc84E512bB9C30f76E30c160eD06FB"
GOERLI_VRF_WRAPPER="0x708701a1DfF4f478de54383E49a627eD4852C816"
GOERLI_VRF_COORDINATOR="0x2ca8e0c643bde4c2e08ab1fa0da3401adad7734d"
GOERLI_LINK_WHALE="0x4a3df8cae46765d33c2551ff5438a5c5fc44347c"
PRIV_KEY=""
PRIV_KEY_2=""
```

To run unit tests in a forked environemnt please use:

`yarn test`

To run tests in Goerli (to check whether raffles complete with a winner) you can run:

`yarn test:live`

For ease of configuration, live tests have been added in a different file. Make sure the accounts you are using have LINK tokens ([faucet here](https://faucets.chain.link/)) and Ether to pay for tx fees ([faucet here](https://goerlifaucet.com/))

You can provide addresses of ERC721 tokens, ERC20 tokens and a deployed instance of RaffleFi so that you do not have to deploy every time you run the tests. These are the extra .env variables to add:

```bash
ERC20_1=
ERC20_2=
ERC721_1=
RAFFLEFI_TESTNET=
```

## Deploy

To deploy, please fill the `.env` file -> `cp .env-template .env`:

```js
RPC_URL_GOERLI=""
GOERLI_LINK="0x326C977E6efc84E512bB9C30f76E30c160eD06FB"
GOERLI_VRF_WRAPPER="0x708701a1DfF4f478de54383E49a627eD4852C816"
GOERLI_VRF_COORDINATOR="0x2ca8e0c643bde4c2e08ab1fa0da3401adad7734d"
GOERLI_LINK_WHALE="0x4a3df8cae46765d33c2551ff5438a5c5fc44347c"
WETH_ADDR="0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6"
VRF_CALLBACK_GAS="100000"
VRF_RETRIES="3"
```

You can deploy your own version using `yarn deploy:$network_name` for instance (for now) you can deploy to goerli using `yarn deploy:goerli`. To test deployment locally you can use `yarn deploy:test`.

## Utilities

If you want to create a private raffle, you can add the allowed addresses in a file named `addresses.txt` within the scripts folder. Then you can run `yarn merkle:generate` to generate proofs and merkle root. These will be saved in `scripts/allowlist.json`

```bash
yarn merkle:generate
yarn run 
$ npx ts-node scripts/genMerkleTree.ts

     ██▀███   ▄▄▄       █████▒  █████▒██▓    ▓█████   █████▒██▓
    ▓██ ▒ ██▒▒████▄    ▓██   ▒▓██   ▒▓██▒    ▓█   ▀ ▓██   ▒▓██▒
    ▓██ ░▄█ ▒▒██  ▀█▄  ▒████ ░▒████ ░▒██░    ▒███   ▒████ ░▒██▒
    ▒██▀▀█▄  ░██▄▄▄▄██ ░▓█▒  ░░▓█▒  ░▒██░    ▒▓█  ▄ ░▓█▒  ░░██░
    ░██▓ ▒██▒ ▓█   ▓██▒░▒█░   ░▒█░   ░██████▒░▒████▒░▒█░   ░██░
    ░ ▒▓ ░▒▓░ ▒▒   ▓▒█░ ▒ ░    ▒ ░   ░ ▒░▓  ░░░ ▒░ ░ ▒ ░   ░▓
      ░▒ ░ ▒░  ▒   ▒▒ ░ ░      ░     ░ ░ ▒  ░ ░ ░  ░ ░      ▒ ░
      ░░   ░   ░   ▒    ░ ░    ░ ░     ░ ░      ░    ░ ░    ▒ ░
       ░           ░  ░                  ░  ░   ░  ░        ░

[*] Generating merkle tree...
[+] The Merkle root is 0x134bdea533b523f6f44fedf351ebd32a7c52b53bfed077c944cc6b48a594b4b6
[*] Writing the allow list data to allowlist.json
[+] Done!
✨  Done in 1.17s.
```

## Safety

This is experimental software and is provided on an "as is" and "as available" basis.

We do not give any warranties and will not be liable for any loss incurred through any use of this codebase.

## License 

MIT License
