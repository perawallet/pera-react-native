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

// `repairQuantumMaterial.spec.ts` drives `repairQuantumMaterial` with a stub
// `regenerate`, and `runKeystoreMaintenance.test.ts` mocks `runMaterialRepair`
// wholesale — neither exercises the real `regenerate` closure that
// `runQuantumMaterialRepair` builds in `singleton.ts`, which is where all of
// this task's risk lives (branch selection, the exported entropy, the derived
// seed, the zeroing). This spec captures that real closure via a mocked
// `runMaterialRepair` and drives it directly against a fake keystore.

import { describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    generate: vi.fn(),
    exportKey: vi.fn(),
    runMaterialRepair: vi.fn(),
}))

vi.mock('react-native-quick-crypto', () => ({ subtle: {} }))

vi.mock('@algorandfoundation/react-native-keystore', () => ({
    WithKeyStore: () => ({ key: { store: {} } }),
    createReactNativeKeyStore: () => ({
        ready: Promise.resolve(),
        generate: mocks.generate,
        export: mocks.exportKey,
    }),
    decode: vi.fn(),
    storage: { getAllKeys: () => [], getString: vi.fn() },
}))

vi.mock('../keystore/maintenance', () => ({
    runMaterialRepair: mocks.runMaterialRepair,
    readPersistedKeys: vi.fn(() => []),
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

import { runQuantumMaterialRepair } from '../singleton'

type Regenerate = (
    childId: string,
    parentKeyId: string,
    derivation: string,
) => Promise<void>

/** Runs `runQuantumMaterialRepair` far enough to capture the real `regenerate`
 * closure it builds, without going through `repairQuantumMaterial`'s own
 * orphan-selection logic (covered elsewhere). */
const captureRegenerate = async (
    deriveKeygenSeed: (entropy: Uint8Array) => Uint8Array,
): Promise<Regenerate> => {
    let captured: Regenerate | undefined
    mocks.runMaterialRepair.mockImplementation(async deps => {
        captured = deps.regenerate
        return { repaired: 0, failed: 0 }
    })

    await runQuantumMaterialRepair({ deriveKeygenSeed })

    if (!captured) throw new Error('regenerate was never captured')
    return captured
}

describe('runQuantumMaterialRepair regenerate closure', () => {
    test('legacy child: generate is called with no seed key', async () => {
        mocks.generate.mockReset().mockResolvedValue(undefined)
        mocks.exportKey.mockReset()
        const regenerate = await captureRegenerate(vi.fn())

        await regenerate('child-1', 'parent-1', 'legacy')

        expect(mocks.exportKey).not.toHaveBeenCalled()
        expect(mocks.generate).toHaveBeenCalledTimes(1)
        const { params } = mocks.generate.mock.calls[0][0]
        expect(params).not.toHaveProperty('seed')
        expect(params).toEqual({
            parentKeyId: 'parent-1',
            id: 'child-1',
            pqDerivation: 'legacy',
        })
    })

    test('canonical child: params.seed is the derived seed', async () => {
        const entropy = new Uint8Array([9, 9, 9])
        const derived = new Uint8Array([1, 2, 3])
        mocks.exportKey.mockReset().mockResolvedValue({ privateKey: entropy })
        mocks.generate.mockReset().mockResolvedValue(undefined)
        const deriveKeygenSeed = vi.fn(() => derived)

        const regenerate = await captureRegenerate(deriveKeygenSeed)
        await regenerate('child-2', 'parent-2', 'pqk1')

        expect(deriveKeygenSeed).toHaveBeenCalledWith(entropy)
        const { params } = mocks.generate.mock.calls[0][0]
        // Same instance the derive returned — proves the seed that reached
        // `generate` is the one `deriveKeygenSeed` produced, not a copy.
        expect(params.seed).toBe(derived)
        expect(params).toMatchObject({
            id: 'child-2',
            parentKeyId: 'parent-2',
            pqDerivation: 'pqk1',
        })
    })

    test('canonical child: derived seed and exported entropy are zeroed even when generate throws', async () => {
        const entropy = new Uint8Array([9, 9, 9])
        const derived = new Uint8Array([1, 2, 3])
        mocks.exportKey.mockReset().mockResolvedValue({ privateKey: entropy })
        mocks.generate.mockReset().mockRejectedValue(new Error('boom'))
        const deriveKeygenSeed = vi.fn(() => derived)

        const regenerate = await captureRegenerate(deriveKeygenSeed)

        await expect(regenerate('child-3', 'parent-3', 'pqk1')).rejects.toThrow(
            'boom',
        )

        expect(derived).toEqual(new Uint8Array(3))
        expect(entropy).toEqual(new Uint8Array(3))
    })

    // Proves the Important-1 fix directly: the derive call itself now sits
    // inside the `try`, so its own throw still reaches the `finally` that
    // zeroes the exported entropy. Before the fix, this assertion failed —
    // `entropy` was left holding its original bytes.
    test('canonical child: exported entropy is zeroed even if deriveKeygenSeed itself throws', async () => {
        const entropy = new Uint8Array([9, 9, 9])
        mocks.exportKey.mockReset().mockResolvedValue({ privateKey: entropy })
        mocks.generate.mockReset()
        const deriveKeygenSeed = vi.fn(() => {
            throw new Error('derive failed')
        })

        const regenerate = await captureRegenerate(deriveKeygenSeed)

        await expect(regenerate('child-4', 'parent-4', 'pqk1')).rejects.toThrow(
            'derive failed',
        )

        expect(entropy).toEqual(new Uint8Array(3))
        expect(mocks.generate).not.toHaveBeenCalled()
    })

    test('an unrecognised derivation throws rather than falling into the canonical branch', async () => {
        mocks.generate.mockReset()
        mocks.exportKey.mockReset()
        const regenerate = await captureRegenerate(vi.fn())

        await expect(
            regenerate('child-5', 'parent-5', 'unknown'),
        ).rejects.toThrow(/unrecognised derivation/)

        expect(mocks.exportKey).not.toHaveBeenCalled()
        expect(mocks.generate).not.toHaveBeenCalled()
    })
})
