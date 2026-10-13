/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

// One chain package reaching into another gets no exemption from its own directory
import { algorandChain } from '@perawallet/wallet-core-chain-algorand'
import { ethereumChain } from '@perawallet/wallet-core-chain-ethereum'

export const uses = [algorandChain, ethereumChain]
