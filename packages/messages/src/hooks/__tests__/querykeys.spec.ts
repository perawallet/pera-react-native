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

import { describe, test, expect } from 'vitest'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { getNotificationsListQueryKey } from '../querykeys'

const MAINNET = scopeForLegacyNetwork('mainnet')
const TESTNET = scopeForLegacyNetwork('testnet')

describe('push-notifications/hooks/querykeys', () => {
    test('should generate correct query key for notifications list', () => {
        const key = getNotificationsListQueryKey(MAINNET, 'device-123')

        expect(key).toEqual([
            'notifications',
            'listv2',
            { deviceID: 'device-123', scope: MAINNET },
        ])
    })

    test('should generate different keys for different scopes', () => {
        const mainnetKey = getNotificationsListQueryKey(MAINNET, 'device-123')
        const testnetKey = getNotificationsListQueryKey(TESTNET, 'device-123')

        expect(mainnetKey).not.toEqual(testnetKey)
    })

    test('should generate different keys for different device IDs', () => {
        const key1 = getNotificationsListQueryKey(MAINNET, 'device-1')
        const key2 = getNotificationsListQueryKey(MAINNET, 'device-2')

        expect(key1).not.toEqual(key2)
    })
})
