/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

declare const useNetworkStore: (
    selector: (state: { mode: string }) => unknown,
) => unknown

export const mode = useNetworkStore(state => state.mode)
