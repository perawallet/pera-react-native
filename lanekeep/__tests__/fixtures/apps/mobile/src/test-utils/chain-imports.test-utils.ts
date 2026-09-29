/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { algorandChain } from '@perawallet/wallet-core-chain-algorand'
import { executeAlgorandSwap } from '@perawallet/wallet-core-chain-algorand/swaps'

export const uses = [algorandChain, executeAlgorandSwap]
