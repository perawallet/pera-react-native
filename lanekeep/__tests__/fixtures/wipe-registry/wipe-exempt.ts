/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { create } from 'zustand'

// lanekeep-ignore-next-line pera/store-in-wipe-registry reason: device connectivity; a reset reports online until the next event
export const useExemptStore = create<{ online: boolean }>()(() => ({
    online: true,
}))
