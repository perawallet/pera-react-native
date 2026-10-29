/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { registerStore } from '@perawallet/wallet-core-shared'
import { useCrossFileStore } from './wipe-cross-file-store'

registerStore({
    name: 'cross-file',
    clearStorage: () => {},
    resetState: () => useCrossFileStore.setState({ n: 0 }),
})
