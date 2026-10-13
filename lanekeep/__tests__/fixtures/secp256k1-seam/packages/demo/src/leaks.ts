import { HDKey } from '@scure/bip32'
import * as secp from '@noble/secp256k1'
import { secp256k1 } from '@noble/curves/secp256k1.js'
export * from '@noble/curves/secp256k1'

export const later = () => import(`@noble/secp256k1`)
export const legacy = () => require('@scure/bip32')
export const all = { HDKey, secp, secp256k1 }
