/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

// Fixture stands in for a shared package reaching into a chain package directly
import { algorandChain } from '@perawallet/wallet-core-chain-algorand'
import type { AlgorandAccount } from '@perawallet/wallet-core-chain-algorand'
import { signTransaction } from '@perawallet/wallet-core-chain-algorand/signing'

export type { AlgorandAsset } from '@perawallet/wallet-core-chain-algorand'
export * from '@perawallet/wallet-core-chain-algorand'

export const load = () => import('@perawallet/wallet-core-chain-algorand')

import type { Chain } from '@perawallet/wallet-core-chain-contract'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'

export const uses = [
    algorandChain,
    signTransaction,
    useNetworkStore,
    null as unknown as AlgorandAccount,
    null as unknown as Chain,
]
