/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { create } from 'zustand'
import { guardedPersist } from '@perawallet/wallet-core-shared'

export const usePersistedStore = create<{ n: number }>()(
    guardedPersist(() => ({ n: 0 }), { name: 'persisted' }),
)
