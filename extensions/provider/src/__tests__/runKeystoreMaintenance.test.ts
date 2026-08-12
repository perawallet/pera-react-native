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

import { beforeEach, describe, expect, test, vi } from 'vitest'

// Ordered log of the passes, so the assertions below are about *sequence*, not
// just "was it called". The ordering is the whole contract: the engine's
// `ready` hydrates from `k/` only, so the re-index has to follow it and the
// reconcile has to follow the re-index.
const calls: string[] = []

const mocks = vi.hoisted(() => ({
    runLayoutMigration: vi.fn(),
    runMaterialRepair: vi.fn(),
    readPersistedKeys: vi.fn(),
}))

vi.mock('react-native-quick-crypto', () => ({ subtle: {} }))

vi.mock('@algorandfoundation/react-native-keystore', () => ({
    WithKeyStore: () => ({ key: { store: {} } }),
    createReactNativeKeyStore: () => ({ ready: Promise.resolve() }),
    decode: vi.fn(),
    storage: { getAllKeys: () => [], getString: vi.fn() },
}))

vi.mock('../keystore/maintenance', () => ({
    runLayoutMigration: mocks.runLayoutMigration,
    runMaterialRepair: mocks.runMaterialRepair,
    readPersistedKeys: mocks.readPersistedKeys,
}))

vi.mock('@perawallet/wallet-extension-ledger-react-native', () => ({
    WithLedgerExtension: () => ({}),
}))

vi.mock('@perawallet/wallet-extension-ledger-react-native-usb', () => ({
    WithLedgerUsbExtension: () => ({}),
}))

vi.mock('@tanstack/store', () => ({
    Store: class {
        state: { keys: unknown[]; status: string }
        constructor(initial: { keys: unknown[]; status: string }) {
            this.state = { ...initial }
        }
        setState(
            updater: (prev: { keys: unknown[]; status: string }) => {
                keys: unknown[]
                status: string
            },
        ) {
            this.state = updater(this.state)
        }
    },
}))

vi.mock('before-after-hook', () => ({
    default: { Collection: class {} },
}))

import { runKeystoreMaintenance } from '../singleton'

const NO_MIGRATION = { migrated: 0, skipped: 0, failed: 0 }
const NO_REPAIR = { repaired: 0, failed: 0 }

describe('runKeystoreMaintenance', () => {
    beforeEach(() => {
        calls.length = 0
        mocks.runLayoutMigration.mockReset()
        mocks.runMaterialRepair.mockReset()
        mocks.readPersistedKeys.mockReset()

        mocks.runLayoutMigration.mockImplementation(async () => {
            calls.push('migrate')
            return NO_MIGRATION
        })
        mocks.runMaterialRepair.mockImplementation(async () => {
            calls.push('repair')
            return NO_REPAIR
        })
        // `reconcileKeystore` is internal; this is how it announces itself.
        mocks.readPersistedKeys.mockImplementation(() => {
            calls.push('reconcile')
            return [{ id: 'k1' }]
        })
    })

    test('re-indexes, then reconciles so the re-indexed keys reach the store', async () => {
        mocks.runLayoutMigration.mockImplementation(async () => {
            calls.push('migrate')
            return { migrated: 2, skipped: 0, failed: 0 }
        })

        const result = await runKeystoreMaintenance()

        expect(calls).toEqual(['migrate', 'reconcile', 'repair'])
        expect(result.migration.migrated).toBe(2)
    })

    // Reconcile re-reads every entry; paying that on a launch where nothing
    // changed is pure cost.
    test('skips the reconcile entirely when both passes are no-ops', async () => {
        await runKeystoreMaintenance()

        expect(calls).toEqual(['migrate', 'repair'])
    })

    // A quantum account minted before custody moved into the keystore has a
    // child with no sealed material, and nothing to migrate — it would fail
    // only at submit time, after the user had already signed.
    test('repairs quantum material even when nothing migrated, and reconciles for it', async () => {
        mocks.runMaterialRepair.mockImplementation(async () => {
            calls.push('repair')
            return { repaired: 1, failed: 0 }
        })

        const result = await runKeystoreMaintenance()

        expect(calls).toEqual(['migrate', 'repair', 'reconcile'])
        expect(result.repair.repaired).toBe(1)
    })

    // Left-behind work still has to reach the store, and still has to be
    // visible to the caller.
    test('reconciles and reports when a pass failed rather than swallowing it', async () => {
        mocks.runLayoutMigration.mockImplementation(async () => {
            calls.push('migrate')
            return { migrated: 0, skipped: 0, failed: 1 }
        })

        const result = await runKeystoreMaintenance()

        expect(calls).toEqual(['migrate', 'reconcile', 'repair'])
        expect(result.migration.failed).toBe(1)
    })

    // An unreadable master key with canary.13 records still on disk must not
    // boot into an empty wallet — that is what prompts a destructive
    // re-onboard. The caller turns this into a failed bootstrap.
    test('propagates a throw instead of continuing to the repair pass', async () => {
        mocks.runLayoutMigration.mockRejectedValue(
            new Error('master key unreadable'),
        )

        await expect(runKeystoreMaintenance()).rejects.toThrow(
            'master key unreadable',
        )
        expect(calls).not.toContain('repair')
    })
})
