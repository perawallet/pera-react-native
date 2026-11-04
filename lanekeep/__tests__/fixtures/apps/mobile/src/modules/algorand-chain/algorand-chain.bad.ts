/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { ALGORAND_CHAIN_ID } from '@modules/algorand/chain-id'

declare const useSelectedScope: (chainId: string) => object

export const scope = useSelectedScope(ALGORAND_CHAIN_ID)
