# RaffleFi

RaffleFi is a protocol that can be used to create on chain raffles. 

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

## Deploy

You can deploy your own version using `yarn deploy:$network_name`

## Safety

This is experimental software and is provided on an "as is" and "as available" basis.

We do not give any warranties and will not be liable for any loss incurred through any use of this codebase.

## License 

MIT License
