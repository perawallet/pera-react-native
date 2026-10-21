/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

declare const useSelectedScope: (chainId: string) => object

export const scope = useSelectedScope(LEGACY_CHAIN_ID)
