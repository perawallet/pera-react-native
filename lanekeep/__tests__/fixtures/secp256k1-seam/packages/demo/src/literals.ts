import { ed25519 } from '@noble/curves/ed25519.js'
import { sha256 } from '@noble/hashes/sha2.js'

export const SECP256K1_KEY_SCHEME = 'secp256k1'
export const isSecp = (scheme: string) => scheme === '@noble/secp256k1'
export const others = { ed25519, sha256 }
