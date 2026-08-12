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
import { openNativeProviderRecord } from '../../native/nativeProviderRecord'

// Standard base64, matching `@scure/base`'s `base64` — restated locally rather
// than imported so this package needs no bundler-visible dependency for it.
const base64 = {
    encode: (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)),
    decode: (value: string): Uint8Array =>
        Uint8Array.from(atob(value), char => char.charCodeAt(0)),
}

const MASTER_KEY = Buffer.alloc(32, 7)
const IV_LENGTH = 12

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

    const store = new Map<string, string>()

    return {
        readMasterKey: vi.fn(),
        store,
        storage: {
            getAllKeys: () => [...store.keys()],
            getString: (key: string) => store.get(key),
            set: (key: string, value: string) => store.set(key, value),
        },
        openData: vi.fn(
            async (
                subtle: SubtleCrypto,
                key: Uint8Array,
                payload: string,
            ): Promise<string> => {
                const { iv, content } = JSON.parse(payload)
                return new TextDecoder().decode(
                    await subtle.decrypt(
                        { name: 'AES-GCM', iv: base64.decode(iv) },
                        await subtle.importKey(
                            'raw',
                            key,
                            { name: 'AES-GCM' },
                            false,
                            ['decrypt'],
                        ),
                        base64.decode(content),
                    ),
                )
            },
        ),
        warn: vi.fn(),
        error: vi.fn(),
        MasterKeyNotFoundError,
    }
})

vi.mock('@algorandfoundation/react-native-keystore', () => ({
    readMasterKey: mocks.readMasterKey,
    storage: mocks.storage,
    MasterKeyNotFoundError: mocks.MasterKeyNotFoundError,
    // canary.14's codecs, restated over the same primitives for the same
    // reason as the class above. `decode` reads the `{$u8}` metadata the
    // Keychain driver writes into `k/`; `openData` unseals `m/`.
    decode: (data: string) =>
        JSON.parse(data, (_k, value) =>
            value && typeof value === 'object' && typeof value.$u8 === 'string'
                ? base64.decode(value.$u8)
                : value,
        ),
    openData: mocks.openData,
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { warn: mocks.warn, error: mocks.error },
}))

import {
    bootstrapPasskeyAutofill,
    __resetBootstrapForTests,
} from '../bootstrapPasskeyAutofill'

const subtle = globalThis.crypto.subtle

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

/** canary.14 `sealData`: `{iv, content}` with the GCM tag inside `content`. */
const sealMaterial = async (bytes: Uint8Array): Promise<string> => {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
    const ciphertext = new Uint8Array(
        await subtle.encrypt(
            { name: 'AES-GCM', iv },
            await subtle.importKey(
                'raw',
                Uint8Array.from(MASTER_KEY),
                { name: 'AES-GCM' },
                false,
                ['encrypt'],
            ),
            new TextEncoder().encode(base64.encode(bytes)),
        ),
    )
    return JSON.stringify({
        iv: base64.encode(iv),
        content: base64.encode(ciphertext),
    })
}

/** Writes a record the way the canary.14 driver does: `k/` meta, `m/` material. */
const seedKeystore = async (
    record: { id: string; type: string } & Record<string, unknown>,
    material?: Uint8Array,
) => {
    mocks.store.set(
        `k/${record.id}`,
        JSON.stringify(record, (_k, value) =>
            value instanceof Uint8Array ? { $u8: base64.encode(value) } : value,
        ),
    )
    if (material) {
        mocks.store.set(`m/${record.id}`, await sealMaterial(material))
    }
}

const ROOT_SEED = new Uint8Array(96).fill(5)

const seedHdRoot = (id = 'root-id') =>
    seedKeystore({ id, type: 'hd-root-key', algorithm: 'raw' }, ROOT_SEED)

/** The record the credential provider would read back at the bare id. */
const shadowRecord = async (id = 'root-id') =>
    (await openNativeProviderRecord(
        subtle,
        Uint8Array.from(MASTER_KEY),
        mocks.store.get(id)!,
    )) as Record<string, unknown>

describe('bootstrapPasskeyAutofill', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        __resetBootstrapForTests()
        mocks.store.clear()
        mocks.readMasterKey.mockResolvedValue(Buffer.from(MASTER_KEY))
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
        await seedKeystore({ id: 'k1', type: 'algo25' })
        await seedKeystore(
            { id: 'root-id', type: 'hd-root-key', algorithm: 'raw' },
            Uint8Array.from([1, 2, 3]),
        )

        await bootstrapPasskeyAutofill({
            service: service as never,
            intentActions,
        })

        expect(receivedMasterKey).toEqual(Buffer.from(MASTER_KEY))
        expect(service.setHdRootKeyId).toHaveBeenCalledWith('root-id')
        expect(service.setDerivedMainKey).toHaveBeenCalledWith('010203')
        expect(service.configureIntentActions).toHaveBeenCalledWith(
            'GET_ACTION',
            'CREATE_ACTION',
        )
        expect(service.refreshCredentialIdentities).toHaveBeenCalled()
    })

    // The whole point of phase 2: canary.14 puts the root in `k/`+`m/`, and the
    // provider is a separate process that only ever reads the bare id.
    describe('the bare-id shadow the credential provider reads', () => {
        it('writes the root material where getHdRootSecret looks for it', async () => {
            const service = makeService()
            await seedHdRoot()

            await bootstrapPasskeyAutofill({
                service: service as never,
                intentActions,
            })

            expect(service.setHdRootKeyId).toHaveBeenCalledWith('root-id')
            const record = await shadowRecord()
            // `optJSONArray("seed")` — a number array, never `{$u8}`.
            expect(record.seed).toEqual(Array.from(ROOT_SEED))
        })

        it('leaves an existing readable shadow untouched', async () => {
            const service = makeService()
            await seedHdRoot()
            await bootstrapPasskeyAutofill({
                service: service as never,
                intentActions,
            })
            const written = mocks.store.get('root-id')

            __resetBootstrapForTests()
            await bootstrapPasskeyAutofill({
                service: service as never,
                intentActions,
            })

            expect(mocks.store.get('root-id')).toBe(written)
        })

        // A canary.13 install already has one, in the format the provider
        // parses. Rewriting it would be churn; losing it would break the user.
        it('preserves a shipped canary.13 record verbatim', async () => {
            const service = makeService()
            await seedHdRoot()
            const shipped = await (
                await import('../../native/nativeProviderRecord')
            ).sealNativeProviderRecord(subtle, Uint8Array.from(MASTER_KEY), {
                id: 'root-id',
                type: 'hd-root-key',
                privateKey: Array.from(ROOT_SEED),
            })
            mocks.store.set('root-id', shipped)

            await bootstrapPasskeyAutofill({
                service: service as never,
                intentActions,
            })

            expect(mocks.store.get('root-id')).toBe(shipped)
        })

        it('rewrites a shadow that no longer decrypts', async () => {
            const service = makeService()
            await seedHdRoot()
            mocks.store.set('root-id', 'corrupt-not-an-envelope')

            await bootstrapPasskeyAutofill({
                service: service as never,
                intentActions,
            })

            expect((await shadowRecord()).seed).toEqual(Array.from(ROOT_SEED))
        })

        it('still wires the root id when the shadow write fails', async () => {
            const service = makeService()
            await seedHdRoot()
            vi.spyOn(mocks.storage, 'set').mockImplementationOnce(() => {
                throw new Error('mmkv full')
            })

            await bootstrapPasskeyAutofill({
                service: service as never,
                intentActions,
            })

            expect(service.setHdRootKeyId).toHaveBeenCalledWith('root-id')
            expect(mocks.error).toHaveBeenCalledWith(expect.any(Error), {
                step: 'syncNativeProviderHdRoot',
            })
        })
    })

    it('zeroes the master-key bytes after handing them to the native side', async () => {
        const service = makeService()
        let sharedRef: Uint8Array | null = null
        service.setMasterKey.mockImplementation(async (bytes: Uint8Array) => {
            sharedRef = bytes
        })

        await bootstrapPasskeyAutofill({
            service: service as never,
            intentActions,
        })

        // The Uint8Array handed to the native bridge is wiped once bootstrap
        // unwinds — no non-zeroable secret lingers.
        expect(sharedRef).toEqual(new Uint8Array(32))
    })

    it('skips refreshing identities when the credential provider is inactive', async () => {
        const service = makeService()
        service.isProviderActive.mockResolvedValue(false)

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
        await seedHdRoot()

        await bootstrapPasskeyAutofill({
            service: service as never,
            intentActions,
        })

        // HD root id is still wired; the secret hex string is never materialized.
        expect(service.setHdRootKeyId).toHaveBeenCalledWith('root-id')
        expect(service.setDerivedMainKey).not.toHaveBeenCalled()
    })

    it('does not push a derived main key when the HD root has no sealed material', async () => {
        const service = makeService()
        await seedKeystore({ id: 'root-id', type: 'xhd-root-key' })

        await bootstrapPasskeyAutofill({
            service: service as never,
            intentActions,
        })

        expect(service.setHdRootKeyId).toHaveBeenCalledWith('root-id')
        expect(service.setDerivedMainKey).not.toHaveBeenCalled()
    })

    it('warns and skips HD wiring when the keystore MMKV namespace is empty', async () => {
        const service = makeService()

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

    // The `k/` bucket is plaintext metadata, so the root is found by reading
    // it. Only the root's own material is unsealed — the previous
    // implementation decrypted every key in the store to find one.
    it('decrypts only the root, not every key in the store', async () => {
        const service = makeService()
        await seedKeystore({ id: 'k1', type: 'algo25' }, new Uint8Array(32))
        await seedKeystore({ id: 'k2', type: 'ed25519' }, new Uint8Array(32))
        await seedHdRoot()

        await bootstrapPasskeyAutofill({
            service: service as never,
            intentActions,
        })

        expect(service.setHdRootKeyId).toHaveBeenCalledWith('root-id')
        expect(mocks.openData).toHaveBeenCalledOnce()
        // And only the root gets a bare-id shadow.
        expect(mocks.store.has('k1')).toBe(false)
        expect(mocks.store.has('k2')).toBe(false)
    })

    it('warns and skips HD wiring when no HD root key is present among the stored keys', async () => {
        const service = makeService()
        await seedKeystore({ id: 'k1', type: 'algo25' })
        await seedKeystore({ id: 'k2', type: 'hd-derived-p256' })

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
        await seedKeystore(
            { id: 'root-id', type: 'hd-root-key', algorithm: 'raw' },
            Uint8Array.from([1, 2, 3]),
        )

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

    it('treats undecryptable root material as absent and warns', async () => {
        const service = makeService()
        await seedKeystore({ id: 'root-id', type: 'hd-root-key' })
        mocks.store.set(
            'm/root-id',
            '{"iv":"AAAAAAAAAAAAAAAA","content":"AA=="}',
        )

        await bootstrapPasskeyAutofill({
            service: service as never,
            intentActions,
        })

        expect(mocks.warn).toHaveBeenCalled()
        expect(service.setDerivedMainKey).not.toHaveBeenCalled()
    })

    it('coalesces overlapping calls into a single in-flight run', async () => {
        const service = makeService()
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

        resolveMaster(Buffer.from(MASTER_KEY))
        await first

        expect(mocks.readMasterKey).toHaveBeenCalledOnce()
    })
})
