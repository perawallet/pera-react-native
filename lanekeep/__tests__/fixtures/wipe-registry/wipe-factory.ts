/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { create } from 'zustand'

export const makeStore = () => create<{ n: number }>()(() => ({ n: 0 }))
