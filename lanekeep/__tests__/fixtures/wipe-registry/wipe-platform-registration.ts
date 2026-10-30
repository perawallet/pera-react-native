/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { registerStore } from '@perawallet/wallet-core-shared'
import { usePlatformStore } from './wipe-platform-store'

registerStore({
    name: 'platform',
    clearStorage: () => {},
    resetState: () => usePlatformStore.setState({ n: 0 }),
})
