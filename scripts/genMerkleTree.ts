import keccak256  from 'keccak256';
import { MerkleTree } from 'merkletreejs'
import fs from "fs"

interface AllowListData {
    leaf: string,
    proof: string[],
    rootHash: string
}

/// @notice create a merkle tree from a list of addresses and return 
/// the proof for the first one
const createMerkleTree = (addresses: string[]): AllowListData[] => {
    const leafNodes = addresses.map((addr: string) => keccak256(addr))
    const merkleTree = new MerkleTree(leafNodes, keccak256, {sortPairs: true})
    const rootHash = `0x${merkleTree.getRoot().toString("hex")}`

    const allowlistData: AllowListData[] = []
    leafNodes.map((node, index) => {
        allowlistData.push({
            leaf: addresses[index],
            proof: merkleTree.getHexProof(node),
            rootHash: rootHash
        })
    })
    return allowlistData
}

/// @notice generate the merkle tree and write the data to a file
const main = async () => {
    console.log(`
     ██▀███   ▄▄▄      █████▒ █████  ▒██▓    ▓█████ █████▒  ██▓
    ▓██ ▒ ██▒▒████▄    ▓██   ▒▓██   ▒▓██▒    ▓█   ▀ ▓██   ▒▓██▒
    ▓██ ░▄█ ▒▒██  ▀█▄  ▒████ ░▒████ ░▒██░    ▒███   ▒████ ░▒██▒
    ▒██▀▀█▄  ░██▄▄▄▄██ ░▓█▒  ░░▓█▒  ░▒██░    ▒▓█  ▄ ░▓█▒  ░░██░
    ░██▓ ▒██▒ ▓█   ▓██▒░▒█░   ░▒█░   ░██████▒░▒████▒░▒█░   ░██░
    ░ ▒▓ ░▒▓░ ▒▒   ▓▒█░ ▒ ░    ▒ ░   ░ ▒░▓  ░░░ ▒░ ░ ▒ ░   ░▓  
      ░▒ ░ ▒░  ▒   ▒▒ ░ ░      ░     ░ ░ ▒  ░ ░ ░  ░ ░      ▒ ░
      ░░   ░   ░   ▒    ░ ░    ░ ░     ░ ░      ░    ░ ░    ▒ ░
       ░           ░  ░                  ░  ░   ░  ░        ░  
    `)

    console.log('[*] Generating merkle tree...')
    if (!fs.existsSync('./scripts/addresses.txt')) throw new Error('[-] Missing addresses.txt file')

    const addresses = fs.readFileSync('./scripts/addresses.txt', 'utf8').split('\n')
    const allowlistData = createMerkleTree(addresses)

    console.log(`[+] The Merkle root is ${allowlistData[0].rootHash}`)

    console.log(`[*] Writing the allowlist data to allowlist.json`)
    fs.writeFileSync('./scripts/allowlist.json', JSON.stringify(allowlistData, null, 2))
    console.log(`[+] Done!`)
}

main().catch()