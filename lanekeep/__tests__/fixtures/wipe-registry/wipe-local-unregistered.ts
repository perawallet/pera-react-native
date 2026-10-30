/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { create } from 'zustand'

const useStore = create<{ n: number }>()(() => ({ n: 0 }))

export const readLocal = () => useStore.getState().n
