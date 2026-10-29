/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { create } from 'zustand'

export const useSameNameStore = create<{ n: number }>()(() => ({ n: 0 }))
