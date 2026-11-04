/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

declare const useAccountScope: (account: object) => object
declare const account: object
declare const constants: { ALGORAND_CHAIN_ID: string }

// ALGORAND_CHAIN_ID named in a comment is fine.
export const scope = useAccountScope(account)
export const label = 'ALGORAND_CHAIN_ID'
export const member = constants.ALGORAND_CHAIN_ID
