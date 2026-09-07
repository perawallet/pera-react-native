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

// Own file rather than more cases in runKeystoreMaintenance.test.ts: the
// keystore singleton is built once at module load, so a rejected `ready`
// needs its own module graph.

const mocks = vi.hoisted(() => ({
    runMaterialRepair: vi.fn(),
    readPersistedKeys: vi.fn(),
    hydrationFailure: new SyntaxError('Unexpected token in JSON'),
}))

vi.mock('react-native-quick-crypto', () => ({ subtle: {} }))

vi.mock('@algorandfoundation/react-native-keystore', () => {
    const ready = Promise.reject(mocks.hydrationFailure)
    // The real engine attaches a handler so an un-awaited `ready` never
    // surfaces as an unhandled rejection; mirror that here.
    ready.catch(() => {})
    return {
        WithKeyStore: () => ({ key: { store: {} } }),
        createReactNativeKeyStore: () => ({ ready }),
        decode: vi.fn(),
        storage: { getAllKeys: () => [], getString: vi.fn() },
    }
})

vi.mock('../keystore/maintenance', () => ({
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

import { runKeystoreMaintenance, KeystoreHydrationError } from '../singleton'

const deps = { deriveKeygenSeed: (entropy: Uint8Array) => entropy }

describe('runKeystoreMaintenance when hydration fails', () => {
    beforeEach(() => {
        mocks.runMaterialRepair.mockReset()
        mocks.readPersistedKeys.mockReset()
        mocks.readPersistedKeys.mockReturnValue({ keys: [], failedIds: [] })
    })

    test('wraps the failure in KeystoreHydrationError when undecodable records explain it', async () => {
        mocks.readPersistedKeys.mockReturnValue({
            keys: [{ id: 'k1' }],
            failedIds: ['k/bad'],
        })

        const failure = await runKeystoreMaintenance(deps).then(
            () => null,
            err => err,
        )

        expect(failure).toBeInstanceOf(KeystoreHydrationError)
        expect((failure as KeystoreHydrationError).failedIds).toEqual(['k/bad'])
        expect((failure as KeystoreHydrationError).cause).toBe(
            mocks.hydrationFailure,
        )
        expect(mocks.runMaterialRepair).not.toHaveBeenCalled()
    })

    // `ready` can also reject for reasons no metadata scan explains (a failed
    // migration, a shim that would not load) — those must reach the caller
    // untranslated.
    test('rethrows the original error when no record is undecodable', async () => {
        const failure = await runKeystoreMaintenance(deps).then(
            () => null,
            err => err,
        )

        expect(failure).toBe(mocks.hydrationFailure)
    })
})
