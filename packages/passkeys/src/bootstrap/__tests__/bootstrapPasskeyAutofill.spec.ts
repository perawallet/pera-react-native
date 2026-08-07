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
import type { KeyData } from '@algorandfoundation/keystore-core'

const mocks = vi.hoisted(() => {
    // Restated rather than imported: the real keystore barrel pulls
    // react-native-mmkv, which has no loadable build here. Source and test
    // both resolve this class through the module mock, so the `instanceof`
    // branch is still what's under test.
    class MasterKeyNotFoundError extends Error {
        constructor() {
            super('Master key not found')
            this.name = 'MasterKeyNotFoundError'
        }
    }

    return {
        readMasterKey: vi.fn(),
        fetchSecret: vi.fn(),
        getAllKeys: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        MasterKeyNotFoundError,
    }
})

vi.mock('@algorandfoundation/react-native-keystore', () => ({
    readMasterKey: mocks.readMasterKey,
    fetchSecret: mocks.fetchSecret,
    storage: { getAllKeys: mocks.getAllKeys },
    MasterKeyNotFoundError: mocks.MasterKeyNotFoundError,
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { warn: mocks.warn, error: mocks.error },
}))

import {
    bootstrapPasskeyAutofill,
    __resetBootstrapForTests,
} from '../bootstrapPasskeyAutofill'

const intentActions = {
    getPasskeyAction: 'GET_ACTION',
    createPasskeyAction: 'CREATE_ACTION',
}

const makeService = () => ({
    setMasterKey: vi.fn().mockResolvedValue(undefined),
    setHdRootKeyId: vi.fn().mockResolvedValue(undefined),
    setDerivedMainKey: vi.fn().mockResolvedValue(undefined),
    supportsDerivedMainKey: true,
    configureIntentActions: vi.fn().mockResolvedValue(undefined),
    isProviderActive: vi.fn().mockResolvedValue(true),
    refreshCredentialIdentities: vi.fn().mockResolvedValue(undefined),
})

// fetchSecret is keyed by the keyId it's asked for; tests register the
// decrypted KeyData each id resolves to.
const wireSecrets = (byId: Record<string, KeyData | null>) => {
    mocks.fetchSecret.mockImplementation(
        async ({ keyId }: { keyId: string }) => byId[keyId] ?? null,
    )
}

describe('bootstrapPasskeyAutofill', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        __resetBootstrapForTests()
        mocks.readMasterKey.mockResolvedValue(Buffer.from('aabbcc', 'hex'))
    })

    it('pushes the master key, HD root id, derived bytes, intent actions, then refreshes identities', async () => {
        const service = makeService()
        // Snapshot the bytes at call time: the bootstrap zeroes the Uint8Array
        // in its finally (after the native side has copied it), so the captured
        // reference would otherwise read as zeros by assertion time.
        let receivedMasterKey: Buffer | null = null
        service.setMasterKey.mockImplementation(async (bytes: Uint8Array) => {
            receivedMasterKey = Buffer.from(bytes)
        })
        mocks.getAllKeys.mockReturnValue(['k1', 'hd'])
        wireSecrets({
            k1: { id: 'k1', type: 'algo25' } as KeyData,
            hd: {
                id: 'root-id',
                type: 'hd-root-key',
                privateKey: new Uint8Array([1, 2, 3]),
            } as unknown as KeyData,
        })

        await bootstrapPasskeyAutofill({
            service: service as never,
            intentActions,
        })

        expect(receivedMasterKey).toEqual(Buffer.from('aabbcc', 'hex'))
        expect(service.setHdRootKeyId).toHaveBeenCalledWith('root-id')
        expect(service.setDerivedMainKey).toHaveBeenCalledWith('010203')
        expect(service.configureIntentActions).toHaveBeenCalledWith(
            'GET_ACTION',
            'CREATE_ACTION',
        )
        expect(service.refreshCredentialIdentities).toHaveBeenCalled()
    })

    it('zeroes the master-key bytes after handing them to the native side', async () => {
        const service = makeService()
        let sharedRef: Uint8Array | null = null
        service.setMasterKey.mockImplementation(async (bytes: Uint8Array) => {
            sharedRef = bytes
        })
        mocks.getAllKeys.mockReturnValue([])

        await bootstrapPasskeyAutofill({
            service: service as never,
            intentActions,
        })

        // The Uint8Array handed to the native bridge is wiped once bootstrap
        // unwinds — no non-zeroable secret lingers.
        expect(sharedRef).toEqual(new Uint8Array([0, 0, 0]))
    })

    it('skips refreshing identities when the credential provider is inactive', async () => {
        const service = makeService()
        service.isProviderActive.mockResolvedValue(false)
        mocks.getAllKeys.mockReturnValue([])

        await bootstrapPasskeyAutofill({
            service: service as never,
            intentActions,
        })

        // The rest of the bootstrap still ran.
        expect(service.setMasterKey).toHaveBeenCalled()
        // But no refresh — nothing to sync to a disabled store, and no error.
        expect(service.refreshCredentialIdentities).not.toHaveBeenCalled()
        expect(mocks.error).not.toHaveBeenCalled()
    })

    it('does not log an error when the identity store is disabled mid-refresh', async () => {
        const service = makeService()
        mocks.getAllKeys.mockReturnValue([])
        // Active at check time, but the store reports disabled on the write
        // (the check→enable race).
        service.refreshCredentialIdentities.mockRejectedValue(
            new Error(
                'The operation couldn’t be completed. (ASCredentialIdentityStoreErrorDomain error 1.)',
            ),
        )

        await bootstrapPasskeyAutofill({
            service: service as never,
            intentActions,
        })

        expect(service.refreshCredentialIdentities).toHaveBeenCalled()
        expect(mocks.error).not.toHaveBeenCalled()
        expect(mocks.warn).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ step: 'refreshCredentialIdentities' }),
        )
    })

    it('logs an error when refresh fails for a non-store-disabled reason', async () => {
        const service = makeService()
        mocks.getAllKeys.mockReturnValue([])
        // App Group misconfiguration shares code 1 but a different domain — a
        // real fault that must still surface.
        service.refreshCredentialIdentities.mockRejectedValue(
            new Error('App Group is not configured for passkey autofill.'),
        )

        await bootstrapPasskeyAutofill({
            service: service as never,
            intentActions,
        })

        expect(mocks.error).toHaveBeenCalledWith(expect.any(Error), {
            step: 'refreshCredentialIdentities',
        })
    })

    it('does not build or push a derived main key when the native side lacks setDerivedMainKey support', async () => {
        const service = makeService()
        service.supportsDerivedMainKey = false
        mocks.getAllKeys.mockReturnValue(['hd'])
        wireSecrets({
            hd: {
                id: 'root-id',
                type: 'hd-root-key',
                privateKey: new Uint8Array([1, 2, 3]),
            } as unknown as KeyData,
        })

        await bootstrapPasskeyAutofill({
            service: service as never,
            intentActions,
        })

        // HD root id is still wired; the secret hex string is never materialized.
        expect(service.setHdRootKeyId).toHaveBeenCalledWith('root-id')
        expect(service.setDerivedMainKey).not.toHaveBeenCalled()
    })

    it('does not push a derived main key when the HD root secret has no private bytes', async () => {
        const service = makeService()
        mocks.getAllKeys.mockReturnValue(['hd'])
        wireSecrets({
            hd: { id: 'root-id', type: 'xhd-root-key' } as KeyData,
        })

        await bootstrapPasskeyAutofill({
            service: service as never,
            intentActions,
        })

        expect(service.setHdRootKeyId).toHaveBeenCalledWith('root-id')
        expect(service.setDerivedMainKey).not.toHaveBeenCalled()
    })

    it('warns and skips HD wiring when the keystore MMKV namespace is empty', async () => {
        const service = makeService()
        mocks.getAllKeys.mockReturnValue([])

        await bootstrapPasskeyAutofill({
            service: service as never,
            intentActions,
        })

        expect(mocks.warn).toHaveBeenCalled()
        expect(service.setHdRootKeyId).not.toHaveBeenCalled()
        // The rest of the bootstrap still runs.
        expect(service.setMasterKey).toHaveBeenCalled()
        expect(service.configureIntentActions).toHaveBeenCalled()
        expect(service.refreshCredentialIdentities).toHaveBeenCalled()
    })

    it('warns and skips HD wiring when no HD root key is present among the stored keys', async () => {
        const service = makeService()
        mocks.getAllKeys.mockReturnValue(['k1', 'k2'])
        wireSecrets({
            k1: { id: 'k1', type: 'algo25' } as KeyData,
            k2: { id: 'k2', type: 'hd-derived-p256' } as KeyData,
        })

        await bootstrapPasskeyAutofill({
            service: service as never,
            intentActions,
        })

        expect(mocks.warn).toHaveBeenCalled()
        expect(service.setHdRootKeyId).not.toHaveBeenCalled()
    })

    it('logs every failing native step but still completes when each call rejects', async () => {
        const service = {
            setMasterKey: vi.fn().mockRejectedValue(new Error('setMasterKey')),
            setHdRootKeyId: vi
                .fn()
                .mockRejectedValue(new Error('setHdRootKeyId')),
            setDerivedMainKey: vi
                .fn()
                .mockRejectedValue(new Error('setDerivedMainKey')),
            supportsDerivedMainKey: true,
            configureIntentActions: vi
                .fn()
                .mockRejectedValue(new Error('configureIntentActions')),
            isProviderActive: vi.fn().mockResolvedValue(true),
            refreshCredentialIdentities: vi
                .fn()
                .mockRejectedValue(new Error('refreshCredentialIdentities')),
        }
        mocks.getAllKeys.mockReturnValue(['hd'])
        wireSecrets({
            hd: {
                id: 'root-id',
                type: 'hd-root-key',
                privateKey: new Uint8Array([1, 2, 3]),
            } as unknown as KeyData,
        })

        await expect(
            bootstrapPasskeyAutofill({
                service: service as never,
                intentActions,
            }),
        ).resolves.toBeUndefined()

        const loggedSteps = mocks.error.mock.calls.map(call => call[1]?.step)
        expect(loggedSteps).toEqual(
            expect.arrayContaining([
                'setMasterKey',
                'setHdRootKeyId',
                'setDerivedMainKey',
                'configureIntentActions',
                'refreshCredentialIdentities',
            ]),
        )
    })

    it('logs through the outer catch when fetching the master key throws', async () => {
        const service = makeService()
        mocks.readMasterKey.mockRejectedValue(new Error('keychain locked'))

        await expect(
            bootstrapPasskeyAutofill({
                service: service as never,
                intentActions,
            }),
        ).resolves.toBeUndefined()

        expect(mocks.error).toHaveBeenCalledWith(expect.any(Error), {
            step: 'bootstrapPasskeyAutofill',
        })
        expect(service.setMasterKey).not.toHaveBeenCalled()
    })

    it('skips quietly when no master key exists yet', async () => {
        const service = makeService()
        mocks.readMasterKey.mockRejectedValue(
            new mocks.MasterKeyNotFoundError(),
        )

        await expect(
            bootstrapPasskeyAutofill({
                service: service as never,
                intentActions,
            }),
        ).resolves.toBeUndefined()

        expect(mocks.error).not.toHaveBeenCalled()
        expect(mocks.warn).toHaveBeenCalled()
        expect(service.setMasterKey).not.toHaveBeenCalled()
    })

    it('treats an undecryptable secret as absent and warns', async () => {
        const service = makeService()
        mocks.getAllKeys.mockReturnValue(['hd'])
        mocks.fetchSecret.mockRejectedValue(new Error('decrypt failed'))

        await bootstrapPasskeyAutofill({
            service: service as never,
            intentActions,
        })

        expect(mocks.warn).toHaveBeenCalled()
        expect(service.setHdRootKeyId).not.toHaveBeenCalled()
    })

    it('coalesces overlapping calls into a single in-flight run', async () => {
        const service = makeService()
        mocks.getAllKeys.mockReturnValue([])
        let resolveMaster: (key: Buffer) => void = () => undefined
        mocks.readMasterKey.mockReturnValue(
            new Promise<Buffer>(resolve => {
                resolveMaster = resolve
            }),
        )

        const first = bootstrapPasskeyAutofill({
            service: service as never,
            intentActions,
        })
        const second = bootstrapPasskeyAutofill({
            service: service as never,
            intentActions,
        })

        // Both callers share the same promise while the first run is pending.
        expect(second).toBe(first)
        expect(mocks.readMasterKey).toHaveBeenCalledTimes(1)

        resolveMaster(Buffer.from('aabbcc', 'hex'))
        await first

        // Lock released — a later call starts a fresh run.
        mocks.readMasterKey.mockResolvedValue(Buffer.from('aabbcc', 'hex'))
        await bootstrapPasskeyAutofill({
            service: service as never,
            intentActions,
        })
        expect(mocks.readMasterKey).toHaveBeenCalledTimes(2)
    })
})
