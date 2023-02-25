import keccak256  from 'keccak256';
import { MerkleTree } from 'merkletreejs'

export interface WhitelistData {
    proof: string[],
    rootHash: string
}

/// @notice create a merkle tree from a list of addresses and return 
/// the proof for the first one
export const createMerkleTree = (addresses: string[]): WhitelistData => {
    const leafNodes = addresses.map((addr: string) => keccak256(addr))
    const merkleTree = new MerkleTree(leafNodes, keccak256, {sortPairs: true})
    const rootHash = `0x${merkleTree.getRoot().toString("hex")}`
    return {
        proof: merkleTree.getHexProof(leafNodes[0]),
        rootHash: rootHash
    }
}