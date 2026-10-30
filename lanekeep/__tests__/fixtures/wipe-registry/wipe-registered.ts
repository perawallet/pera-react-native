/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { create } from 'zustand'
import { registerStore } from '@perawallet/wallet-core-shared'

export const useRegisteredStore = create<{ n: number }>()(() => ({ n: 0 }))

registerStore({
    name: 'registered',
    clearStorage: () => {},
    resetState: () => useRegisteredStore.setState({ n: 0 }),
})
