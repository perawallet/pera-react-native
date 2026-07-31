/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, test, expect, vi } from 'vitest'

// This package has no vitest.setup.ts at all, so importing the real
// (unmocked) blockchain module below — needed to test against the real
// NETWORK_PARTITIONED_QUERY_MODULES rather than a fabricated one — would
// otherwise reach the real platform/provider plumbing and fail resolving
// react-native-mmkv (a native module vitest can't load). Scoped to this file:
// every other test in this package mocks '@perawallet/wallet-core-blockchain'
// wholesale instead (see e.g. useNfdForAddressQuery.test.ts), so nothing else
// needs this.
const keyValueStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
}

vi.mock('@perawallet/wallet-extension-platform-driver', () => ({
    WithPlatformExtension: () => ({ keyValueStorage }),
    getPlatformServices: () => ({ keyValueStorage }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ keyValueStorage }),
}))

import { NETWORK_PARTITIONED_QUERY_MODULES } from '@perawallet/wallet-core-blockchain'
import { MODULE_PREFIX } from '../querykeys'

describe('NETWORK_PARTITIONED_QUERY_MODULES (blockchain)', () => {
    test('includes this package MODULE_PREFIX, so clearCustomNetworkCache sweeps its custom-network entries', () => {
        // blockchain/clearCustomNetworkCache.ts duplicates this package's
        // MODULE_PREFIX rather than importing it (importing back would cycle
        // — nfd depends on blockchain). This test is the drift guard: if
        // MODULE_PREFIX is ever renamed here, this fails in this package,
        // where the rename is happening, instead of silently going stale on
        // the blockchain side.
        expect(NETWORK_PARTITIONED_QUERY_MODULES.has(MODULE_PREFIX)).toBe(true)
    })
})
