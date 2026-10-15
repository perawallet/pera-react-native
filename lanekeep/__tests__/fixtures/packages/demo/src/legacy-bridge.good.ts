/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

declare const a: { legacyNetworkOf: (x: unknown) => string }
declare const scope: object
declare const useNetworkStore: () => unknown
declare const algorandNetworkOf: (s: object) => string

// legacyNetworkOf(scope), scopeForLegacyNetwork('x'), useNetwork() and LEGACY_CHAIN_ID in a comment.
export const member = a.legacyNetworkOf(scope)
export const store = useNetworkStore()
export const own = algorandNetworkOf(scope)
export const text = 'legacyNetworkOf(scope) and LEGACY_CHAIN_ID'
