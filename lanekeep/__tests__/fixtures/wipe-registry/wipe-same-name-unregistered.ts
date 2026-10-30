/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { create } from 'zustand'

// Exported under the same name, but the registration imports the other file.
export const useSameNameStore = create<{ n: number }>()(() => ({ n: 0 }))
