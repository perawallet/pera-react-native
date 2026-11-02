/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

declare const useWalletDeployment: () => string
declare const useNetworkStore: (
    selector: (state: {
        mode: string
        setMode: (mode: string) => void
    }) => unknown,
) => unknown

export const deployment = useWalletDeployment()
export const setMode = useNetworkStore(state => state.setMode)
export const text = 'useNetworkStore(state => state.mode)'
