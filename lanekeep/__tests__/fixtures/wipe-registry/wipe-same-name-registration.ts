/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { registerStore } from '@perawallet/wallet-core-shared'
import { useSameNameStore } from './wipe-same-name-registered'

registerStore({
    name: 'same-name',
    clearStorage: () => {},
    resetState: () => useSameNameStore.setState({ n: 0 }),
})
