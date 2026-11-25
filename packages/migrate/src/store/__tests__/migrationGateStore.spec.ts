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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { getStoreRegistry } from '@perawallet/wallet-core-shared'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useMigrationGateStore } from '../migrationGateStore'

const { hasSecret, getSecretMetadata } = vi.hoisted(() => ({
    hasSecret: vi.fn<(id: string) => boolean>(),
    getSecretMetadata: vi.fn<() => Record<string, string>>(),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    hasSecret,
    getSecretMetadata,
}))

describe('migrationGateStore', () => {
    beforeEach(() => {
        useMigrationGateStore.getState().resetState()
        hasSecret.mockReturnValue(false)
        getSecretMetadata.mockReturnValue({})
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

    test('remembers the addresses of a removed key-bearing account, once each', () => {
        hasSecret.mockReturnValue(true)
        const account = {
            id: 'id-1',
            custody: { kind: 'local', seed: null },
            chains: { algorand: { address: 'ADDR', keyPairId: 'kp-1' } },
        } as unknown as WalletAccount

        useMigrationGateStore.getState().recordRemovedAccount(account)
        useMigrationGateStore.getState().recordRemovedAccount(account)

        expect(
            useMigrationGateStore.getState().removedAccountAddresses,
        ).toEqual(['ADDR'])
        expect(useMigrationGateStore.getState().removedKeyAddresses).toEqual([
            'ADDR',
        ])
    })

    test.each([
        ['watch-only', { kind: 'watch' }],
        ['local without its key', { kind: 'local', seed: null }],
        ['HD without its parent', { kind: 'local', seed: 'bip39' }],
    ])(
        'remembers the removal but keeps the legacy key when %s',
        (kind, custody) => {
            if (kind === 'HD without its parent') {
                hasSecret.mockImplementation(id => id === 'kp-1')
                getSecretMetadata.mockReturnValue({ parentKeyId: 'parent-1' })
            }

            const account = {
                id: 'id-1',
                custody,
                chains: { algorand: { address: 'ADDR', keyPairId: 'kp-1' } },
            } as unknown as WalletAccount
            useMigrationGateStore.getState().recordRemovedAccount(account)

            expect(
                useMigrationGateStore.getState().removedAccountAddresses,
            ).toEqual(['ADDR'])
            expect(
                useMigrationGateStore.getState().removedKeyAddresses,
            ).toEqual([])
        },
    )
})
