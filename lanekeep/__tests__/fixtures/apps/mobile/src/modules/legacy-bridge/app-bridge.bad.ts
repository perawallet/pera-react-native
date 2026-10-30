/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

declare const useNetworkStore: (
    selector: (state: { mode: string }) => unknown,
) => unknown
declare const legacyNetworkOf: (scope: object) => string
declare const useDeviceID: (network: string) => string

export const mode = useNetworkStore(state => state.mode)
export const network = legacyNetworkOf({})
export const deviceId = useDeviceID('mainnet')
