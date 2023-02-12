import keccak256  from 'keccak256';
import { MerkleTree } from 'merkletreejs'
import fs from "fs"

interface WhitelistData {
    proof: string[],
    rootHash: string
}

/// @notice create a merkle tree from a list of addresses and return 
/// the proof for the first one
const createMerkleTree = (addresses: string[]): WhitelistData[] => {
    const leafNodes = addresses.map((addr: string) => keccak256(addr))
    const merkleTree = new MerkleTree(leafNodes, keccak256, {sortPairs: true})
    const rootHash = `0x${merkleTree.getRoot().toString("hex")}`

    const whitelistData: WhitelistData[] = []
    leafNodes.map((node) => {
        whitelistData.push({
            proof: merkleTree.getHexProof(node),
            rootHash: rootHash
        })
    })
    return whitelistData
}

const main = async () => {
    console.log(`
    ██▀███   ▄▄▄        █████▒ █████▒██▓    ▓█████   █████▒██▓
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
    const whitelistData = createMerkleTree(addresses)

    console.log(`[+] The Merkle root is ${whitelistData[0].rootHash}`)

    console.log(`[*] Writing the whitelist data to whitelist.json`)
    fs.writeFileSync('./scripts/whitelist.json', JSON.stringify(whitelistData, null, 2))
    console.log(`[+] Done!`)
}

main().catch()