/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

// App files may reach only the whole-moved subpaths, not a split package's
import { claimAssets } from '@perawallet/wallet-core-chain-algorand/asa-inbox'
import { useFeeDelegation } from '@perawallet/wallet-core-chain-algorand/fee-delegation'
import { toAlgodError } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { executeAlgorandSwap } from '@perawallet/wallet-core-chain-algorand/swaps'
import { ALGORAND_CHAIN_ID } from '@perawallet/wallet-core-chain-algorand'

export const uses = [
    claimAssets,
    useFeeDelegation,
    toAlgodError,
    executeAlgorandSwap,
    ALGORAND_CHAIN_ID,
]
