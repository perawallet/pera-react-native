/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

// Fixture stands in for the mobile composition root
import { algorandChain } from '@perawallet/wallet-core-chain-algorand'
import type { AlgorandAccount } from '@perawallet/wallet-core-chain-algorand'
import { signTransaction } from '@perawallet/wallet-core-chain-algorand/signing'

export type { AlgorandAsset } from '@perawallet/wallet-core-chain-algorand'
export * from '@perawallet/wallet-core-chain-algorand'

export const load = () => import('@perawallet/wallet-core-chain-algorand')

export const uses = [
    algorandChain,
    signTransaction,
    null as unknown as AlgorandAccount,
]
