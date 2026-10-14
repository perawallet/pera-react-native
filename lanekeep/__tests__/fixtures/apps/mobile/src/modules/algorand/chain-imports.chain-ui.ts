/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { getTransactionType } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { aggregateTransactionWarnings } from '@perawallet/wallet-core-chain-algorand/signing'
import { ALGORAND_CHAIN_ID } from '@perawallet/wallet-core-chain-algorand'
import { ethereumChain } from '@perawallet/wallet-core-chain-ethereum'

export const uses = [
    getTransactionType,
    aggregateTransactionWarnings,
    ALGORAND_CHAIN_ID,
    ethereumChain,
]
