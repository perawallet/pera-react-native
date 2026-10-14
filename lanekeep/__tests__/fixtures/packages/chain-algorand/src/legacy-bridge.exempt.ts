/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

declare const LEGACY_CHAIN_ID: string
declare const scope: object
declare const legacyNetworkOf: (s: object) => string

export const chain = LEGACY_CHAIN_ID
export const network = legacyNetworkOf(scope)
