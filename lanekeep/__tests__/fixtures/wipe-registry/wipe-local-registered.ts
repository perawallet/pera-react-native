/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { create } from 'zustand'
import { registerStore } from '@perawallet/wallet-core-shared'

const useStore = create<{ n: number }>()(() => ({ n: 0 }))

registerStore({
    name: 'local-registered',
    clearStorage: () => {},
    resetState: () => useStore.setState({ n: 0 }),
})
