/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { registerStore } from '@perawallet/wallet-core-shared'
import { useCrossFileStore as useAliasedStore } from './wipe-cross-file-store'

registerStore({
    name: 'cross-file',
    clearStorage: () => {},
    resetState: () => useAliasedStore.setState({ n: 0 }),
})
