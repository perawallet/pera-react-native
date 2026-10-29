// Follows the rekey hop and submits to algod: comments are left alone.
export class RekeyError extends Error {}
export const intent = { kind: 'rekeyedTo' }
export type FalconSignature = Uint8Array
export const nodeTimeoutMs = { algod: 5000 }
export const toolkit = 'algokit-utils'
export const scheme = 'ed25519'
export const derivation = { Peikert: 1 }
export const delegatedSig = { lsig: true }
export const exportMethod = 'exportSecp256k1Key'
export const evmChainId = 1
export const family = `${intent.kind} on Ethereum`
export const ALGORAND_SHAPE = 'mixed'
export const useNetworks = () => scheme
/** The quantum signer, never Falcon by name. */
