/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { Networks } from '../../services/blockchain/types'
import { MemoryKeyValueStorage, registerTestPlatform } from '@test-utils'

describe('store/app-store', () => {
    test('initializes defaults, updates, and persists selected keys', async () => {
        const kv = new MemoryKeyValueStorage()

        // Register platform services so app-store persist() can resolve storage via the container
        registerTestPlatform({
            keyValueStorage: kv,
        })

        // First load: verify defaults and update values
        vi.resetModules()
        {
            const { useAppStore } = await import('../app-store')
            const state = useAppStore.getState()

            expect(state.theme).toBe('system')
            expect(state.fcmToken).toBeNull()
            expect(state.network).toBe(Networks.mainnet)

            state.setTheme('dark')
            state.setFcmToken('abc')
            state.setNetwork(Networks.testnet)
        }

        // Second load (fresh module context): verify rehydration from persisted storage
        vi.resetModules()
        {
            const { useAppStore } = await import('../app-store')
            const rehydrated = useAppStore.getState()

            expect(rehydrated.theme).toBe('dark')
            expect(rehydrated.fcmToken).toBe('abc')
            expect(rehydrated.network).toBe(Networks.testnet)
        }
    })
})
