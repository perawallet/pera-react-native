/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

declare const scope: object
declare const legacyNetworkOf: (s: object) => string
declare const scopeForLegacyNetwork: (n: string) => object
declare const useNetwork: () => string
declare const useDeviceID: (network: string) => string

export const a = legacyNetworkOf(scope)
export const b = scopeForLegacyNetwork('mainnet')
export const c = useNetwork()
export const e = useDeviceID('mainnet')
