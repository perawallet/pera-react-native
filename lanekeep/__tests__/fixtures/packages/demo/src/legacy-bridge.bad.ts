/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

declare const LEGACY_CHAIN_ID: string
declare const scope: object
declare const legacyNetworkOf: (s: object) => string
declare const scopeForLegacyNetwork: (n: string) => object
declare const useNetwork: () => string
declare const useDeviceID: (network: string) => string

export const a = legacyNetworkOf(scope)
export const b = scopeForLegacyNetwork('mainnet')
export const c = useNetwork()
export const d = LEGACY_CHAIN_ID
export const e = useDeviceID('mainnet')
