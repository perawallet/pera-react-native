/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { create } from 'zustand'

// Not exported, so another file's import of `useCrossFileStore` can't refer to it.
const useCrossFileStore = create<{ n: number }>(() => ({ n: 0 }))

export const readPrivateCount = () => useCrossFileStore.getState().n
