/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

declare const useAccountScope: (account: object) => object
declare const account: object
declare const constants: { LEGACY_CHAIN_ID: string }

// LEGACY_CHAIN_ID named in a comment is fine.
export const scope = useAccountScope(account)
export const label = 'LEGACY_CHAIN_ID'
export const member = constants.LEGACY_CHAIN_ID
