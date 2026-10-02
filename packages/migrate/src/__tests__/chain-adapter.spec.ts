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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    ChainAdapterNotRegisteredError,
    DuplicateChainAdapterError,
} from '@perawallet/wallet-core-chain-contract'
import {
    migrationAdapterFor,
    migrationChainAdapters,
    type MigrationChainAdapter,
} from '../chain-adapter'

const fakeAdapter = (): MigrationChainAdapter => ({
    chainId: 'algorand',
    migrateAccount: vi.fn(),
    isKeylessAccount: vi.fn(() => false),
    classifyAccountRoute: vi.fn(() => 'route'),
})

describe('migrationChainAdapters', () => {
    beforeEach(() => {
        migrationChainAdapters.reset()
    })

    it("resolves the legacy chain's adapter", () => {
        const adapter = fakeAdapter()
        migrationChainAdapters.register(adapter)

        expect(migrationAdapterFor()).toBe(adapter)
    })

    it('names the missing feature when no adapter is registered', () => {
        expect(() => migrationAdapterFor()).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() => migrationAdapterFor()).toThrow(
            'No migration adapter is registered for chain "algorand"',
        )
    })

    it('refuses a second adapter for the same chain', () => {
        migrationChainAdapters.register(fakeAdapter())

        expect(() => migrationChainAdapters.register(fakeAdapter())).toThrow(
            DuplicateChainAdapterError,
        )
    })
})
