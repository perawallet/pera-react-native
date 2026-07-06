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

import { describe, test, expect, beforeEach } from 'vitest'
import { getStoreRegistry } from '@perawallet/wallet-core-shared'
import { useMigrationGateStore } from '../migrationGateStore'

describe('migrationGateStore', () => {
    beforeEach(() => {
        useMigrationGateStore.getState().resetState()
    })

    test('setSkipped / clearSkipped toggle the persistent skip flag', () => {
        expect(useMigrationGateStore.getState().skipped).toBe(false)

        useMigrationGateStore.getState().setSkipped()
        expect(useMigrationGateStore.getState().skipped).toBe(true)

        useMigrationGateStore.getState().clearSkipped()
        expect(useMigrationGateStore.getState().skipped).toBe(false)
    })

    test('registers with the store registry so a data wipe clears the skip flag', () => {
        const registration = getStoreRegistry().find(
            store => store.name === 'migration-gate-store',
        )
        expect(registration).toBeDefined()

        useMigrationGateStore.getState().setSkipped()
        expect(useMigrationGateStore.getState().skipped).toBe(true)

        registration?.clearStorage()
        registration?.resetState()

        expect(useMigrationGateStore.getState().skipped).toBe(false)
    })
})
