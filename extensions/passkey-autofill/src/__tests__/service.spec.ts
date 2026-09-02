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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-native', () => ({
    Platform: { OS: 'ios' },
}))

import { Platform } from 'react-native'
import { PasskeyAutofillService } from '../service'
import type { PasskeyAutofillNativeAPI } from '../service'

const setPlatform = (os: 'ios' | 'android') => {
    ;(Platform as { OS: string }).OS = os
}

// Builds a native API double. Pass only the methods a test cares about;
// omitted optional methods exercise the absent-method fallback path.
const makeNative = (
    overrides: Partial<PasskeyAutofillNativeAPI> = {},
): PasskeyAutofillNativeAPI =>
    ({
        setMasterKey: vi.fn().mockResolvedValue(undefined),
        setHdRootKeyId: vi.fn().mockResolvedValue(undefined),
        configureIntentActions: vi.fn().mockResolvedValue(undefined),
        clearCredentials: vi.fn().mockResolvedValue(undefined),
        deleteCredential: vi.fn().mockResolvedValue(undefined),
        isProviderActive: vi.fn().mockResolvedValue(true),
        openProviderSettings: vi.fn().mockResolvedValue(true),
        addListener: vi.fn(() => ({ remove: vi.fn() })),
        ...overrides,
    }) as PasskeyAutofillNativeAPI

describe('PasskeyAutofillService', () => {
    beforeEach(() => setPlatform('ios'))
    afterEach(() => vi.clearAllMocks())

    describe('key material handling', () => {
        it('hands the master key to native as raw bytes, unchanged', async () => {
            const native = makeNative()
            const service = new PasskeyAutofillService(native)
            const secret = new Uint8Array([0xde, 0xad, 0xbe, 0xef])

            await service.setMasterKey(secret)

            expect(native.setMasterKey).toHaveBeenCalledWith(secret)
        })

        it('normalizes the derived main key hex', async () => {
            const setDerivedMainKey = vi.fn().mockResolvedValue(undefined)
            const service = new PasskeyAutofillService(
                makeNative({ setDerivedMainKey }),
            )

            await service.setDerivedMainKey('0Xfeed')

            expect(setDerivedMainKey).toHaveBeenCalledWith('feed')
        })
    })

    describe('absent native methods', () => {
        it('resolves getStoredCredentials to [] when the native module lacks it (Android)', async () => {
            const service = new PasskeyAutofillService(makeNative())

            await expect(service.getStoredCredentials()).resolves.toEqual([])
        })

        it('resolves isProviderActive to false when the native module lacks it', async () => {
            const native = makeNative()
            // Force the method to be absent.
            ;(native as { isProviderActive?: unknown }).isProviderActive =
                undefined
            const service = new PasskeyAutofillService(native)

            await expect(service.isProviderActive()).resolves.toBe(false)
        })

        it('resolves getHdRootKeyId to null when the native module lacks it', async () => {
            const service = new PasskeyAutofillService(makeNative())

            await expect(service.getHdRootKeyId()).resolves.toBeNull()
        })

        it('no-ops setDerivedMainKey on builds that do not expose it', async () => {
            const service = new PasskeyAutofillService(makeNative())

            await expect(
                service.setDerivedMainKey('abcd'),
            ).resolves.toBeUndefined()
        })

        it('reports supportsDerivedMainKey from the presence of the native method', () => {
            // Default native double has no setDerivedMainKey → unsupported.
            expect(
                new PasskeyAutofillService(makeNative()).supportsDerivedMainKey,
            ).toBe(false)

            expect(
                new PasskeyAutofillService(
                    makeNative({ setDerivedMainKey: vi.fn() }),
                ).supportsDerivedMainKey,
            ).toBe(true)
        })
    })

    describe('configureIntentActions platform gating', () => {
        it('calls the native module on Android', async () => {
            const native = makeNative()
            setPlatform('android')
            const service = new PasskeyAutofillService(native)

            await service.configureIntentActions('GET_ACTION', 'CREATE_ACTION')

            expect(native.configureIntentActions).toHaveBeenCalledWith(
                'GET_ACTION',
                'CREATE_ACTION',
            )
        })

        it('no-ops on iOS (the extension is wired through entitlements there)', async () => {
            const native = makeNative()
            const service = new PasskeyAutofillService(native)

            await service.configureIntentActions('GET_ACTION', 'CREATE_ACTION')

            expect(native.configureIntentActions).not.toHaveBeenCalled()
        })
    })

    describe('pass-through calls', () => {
        it('forwards deleteCredential to native with the credential id', async () => {
            const native = makeNative()
            const service = new PasskeyAutofillService(native)

            await service.deleteCredential('cred-1')

            expect(native.deleteCredential).toHaveBeenCalledWith('cred-1')
        })

        it('returns the native isProviderActive / openProviderSettings results', async () => {
            const service = new PasskeyAutofillService(
                makeNative({
                    isProviderActive: vi.fn().mockResolvedValue(true),
                    openProviderSettings: vi.fn().mockResolvedValue(false),
                }),
            )

            await expect(service.isProviderActive()).resolves.toBe(true)
            await expect(service.openProviderSettings()).resolves.toBe(false)
        })
    })

    it('returns the natively stored HD root key id', async () => {
        const getHdRootKeyId = vi.fn().mockResolvedValue('root-1')
        const service = new PasskeyAutofillService(
            makeNative({ getHdRootKeyId }),
        )

        await expect(service.getHdRootKeyId()).resolves.toBe('root-1')
    })

    it('converts a synchronous throw from the native bridge into a promise rejection', async () => {
        const native = makeNative({
            isProviderActive: vi.fn(() => {
                throw new Error('bridge exploded')
            }),
        })
        const service = new PasskeyAutofillService(native)

        await expect(service.isProviderActive()).rejects.toThrow(
            'bridge exploded',
        )
    })

    describe('event subscriptions', () => {
        it('subscribes through native.addListener and returns its subscription', () => {
            const remove = vi.fn()
            const addListener = vi.fn(() => ({ remove }))
            const service = new PasskeyAutofillService(
                makeNative({ addListener }),
            )
            const cb = vi.fn()

            const sub = service.onPasskeyAdded(cb)

            expect(addListener).toHaveBeenCalledWith('onPasskeyAdded', cb)
            expect(sub.remove).toBe(remove)
        })

        it('returns a no-op subscription when native has no addListener', () => {
            const native = makeNative()
            ;(native as { addListener?: unknown }).addListener = undefined
            const service = new PasskeyAutofillService(native)

            const sub = service.onPasskeyAuthenticated(vi.fn())

            // Must be safely callable even though there is nothing to remove.
            expect(() => sub.remove()).not.toThrow()
        })
    })
})
