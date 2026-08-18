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
// just "was it called". `keystore.ready` now already sits behind
// `provider.migrations.ready` (see singletonMigrationsWiring.spec.ts), so this
// function no longer sequences a migration itself — it only has to reconcile
// after hydration and run the quantum repair.
const calls: string[] = []

const mocks = vi.hoisted(() => ({
    runMaterialRepair: vi.fn(),
    readPersistedKeys: vi.fn(),
    runStrandedRepair: vi.fn(),
}))

vi.mock('react-native-quick-crypto', () => ({ subtle: {} }))

vi.mock('@algorandfoundation/react-native-keystore', () => ({
    WithKeyStore: () => ({ key: { store: {} } }),
    createReactNativeKeyStore: () => ({ ready: Promise.resolve() }),
    decode: vi.fn(),
    storage: { getAllKeys: () => [], getString: vi.fn() },
}))

vi.mock('../keystore/maintenance', () => ({
    runMaterialRepair: mocks.runMaterialRepair,
    readPersistedKeys: mocks.readPersistedKeys,
    runStrandedRepair: mocks.runStrandedRepair,
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

const NO_REPAIR = { repaired: 0, failed: 0 }
const NO_STRANDED_WORK = {
    adopted: [],
    reconstructed: [],
    quarantined: [],
    restored: [],
    leftFlat: [],
    failed: [],
}

describe('runKeystoreMaintenance', () => {
    beforeEach(() => {
        calls.length = 0
        mocks.runMaterialRepair.mockReset()
        mocks.readPersistedKeys.mockReset()
        mocks.runStrandedRepair.mockReset()

        mocks.runMaterialRepair.mockImplementation(async () => {
            calls.push('repair')
            return NO_REPAIR
        })
        mocks.runStrandedRepair.mockImplementation(async () => {
            calls.push('stranded')
            return NO_STRANDED_WORK
        })
        // `reconcileKeystore` is internal; this is how it announces itself.
        mocks.readPersistedKeys.mockImplementation(() => {
            calls.push('reconcile')
            return [{ id: 'k1' }]
        })
    })

    test('reconciles once after ready, then runs stranded repair and the quantum repair', async () => {
        const result = await runKeystoreMaintenance()

        expect(calls).toEqual(['reconcile', 'stranded', 'repair'])
        expect(result).toEqual({ repair: NO_REPAIR })
    })

    // A quantum account minted before custody moved into the keystore has a
    // child with no sealed material, and repairing it must reach the store.
    test('reconciles again when the repair reports work done', async () => {
        mocks.runMaterialRepair.mockImplementation(async () => {
            calls.push('repair')
            return { repaired: 1, failed: 0 }
        })

        const result = await runKeystoreMaintenance()

        expect(calls).toEqual(['reconcile', 'stranded', 'repair', 'reconcile'])
        expect(result.repair.repaired).toBe(1)
    })

    // Left-behind work still has to reach the store, and still has to be
    // visible to the caller.
    test('reconciles again when the repair reports a failure', async () => {
        mocks.runMaterialRepair.mockImplementation(async () => {
            calls.push('repair')
            return { repaired: 0, failed: 1 }
        })

        const result = await runKeystoreMaintenance()

        expect(calls).toEqual(['reconcile', 'stranded', 'repair', 'reconcile'])
        expect(result.repair.failed).toBe(1)
    })

    // A device whose only stranded work was a moved passkey or an adopted
    // seed still has to reach the reactive store before the quantum repair
    // runs off it.
    test('reconciles again when the stranded repair adopts or restores something', async () => {
        mocks.runStrandedRepair.mockImplementation(async () => {
            calls.push('stranded')
            return { ...NO_STRANDED_WORK, restored: ['cred-1'] }
        })

        await runKeystoreMaintenance()

        expect(calls).toEqual(['reconcile', 'stranded', 'reconcile', 'repair'])
    })

    // An unreadable master key still on disk must not boot into an empty
    // wallet — that is what prompts a destructive re-onboard. The caller
    // (`useAppBootstrap`) turns this into a failed bootstrap.
    test('propagates a throw from the repair pass, without reconciling again', async () => {
        mocks.runMaterialRepair.mockImplementation(async () => {
            calls.push('repair')
            throw new Error('master key unreadable')
        })

        await expect(runKeystoreMaintenance()).rejects.toThrow(
            'master key unreadable',
        )
        expect(calls).toEqual(['reconcile', 'stranded', 'repair'])
    })
})
