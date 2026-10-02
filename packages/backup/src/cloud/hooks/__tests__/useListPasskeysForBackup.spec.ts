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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
    useListPasskeyMetadataForBackup,
    useListPasskeysForBackup,
} from '../useListPasskeysForBackup'
import { useProvenPasskeysStore } from '../../store/provenPasskeysStore'

const keystoreKeys = vi.fn().mockReturnValue([])
const inputsFor = vi.fn()
const backupSeedReferenceMock = vi.fn<(seedKeyId: string) => Promise<string>>()
const entropyChildIdOfMock = vi.fn<() => string | undefined>()
const withSecretMock = vi.fn<() => Promise<Uint8Array | null>>()
const zeroBytesMock = vi.fn<(secret: Uint8Array) => void>()
const canAccessMock = vi.fn<(key: unknown, domain: string) => boolean>()
const readPrivateKeyMock = vi.fn<(id: string) => Promise<Uint8Array | null>>()
const disposeReaderMock = vi.fn(async () => {})
const storedInputsFor = vi.fn()

vi.mock('../../../chain-adapter', async importOriginal => ({
    ...(await importOriginal<object>()),
    backupSeedReference: (seedKeyId: string) =>
        backupSeedReferenceMock(seedKeyId),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    BACKUP_ACCESS_DOMAIN: 'backup-flow',
    canAccess: (key: unknown, domain: string) => canAccessMock(key, domain),
    entropyChildIdOf: () => entropyChildIdOfMock(),
    withSecret: () => withSecretMock(),
    zeroBytes: (secret: Uint8Array) => zeroBytesMock(secret),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => ({ state: { keys: keystoreKeys() } }),
    keystoreSubtle: {},
}))

vi.mock('@perawallet/wallet-core-passkeys', () => ({
    createPasskeyPrivateKeyReader: () =>
        Object.assign((id: string) => readPrivateKeyMock(id), {
            dispose: disposeReaderMock,
        }),
    isPasskeyKey: (key: { id: string }) => key.id !== 'seed-1',
    passkeyBackupInputs: (...args: unknown[]) => inputsFor(...args),
    storedPasskeyBackupInputs: (...args: unknown[]) => storedInputsFor(...args),
}))

const derivedInputs = (credentialId = 'a') => ({
    credentialId,
    origin: 'webauthn.io',
    identity: 'alice',
    counter: 0,
    publicKeySpkiDer: 'cHVi',
    seedKeyId: 'seed-1',
    createdAt: 1,
    privateKey: new Uint8Array(32).fill(1),
})

describe('useListPasskeysForBackup', () => {
    beforeEach(() => {
        act(() => useProvenPasskeysStore.getState().resetState())
        backupSeedReferenceMock.mockReset().mockResolvedValue('SEED-REF')
        inputsFor.mockReset()
        entropyChildIdOfMock.mockReset().mockReturnValue(undefined)
        withSecretMock.mockReset().mockResolvedValue(null)
        zeroBytesMock.mockReset()
        canAccessMock.mockReset().mockReturnValue(true)
        readPrivateKeyMock.mockReset().mockResolvedValue(null)
        disposeReaderMock.mockClear()
        storedInputsFor.mockReset()
    })

    it('drops credentials that cannot be re-derived', async () => {
        keystoreKeys.mockReturnValue([{ id: 'a' }, { id: 'b' }])
        inputsFor
            .mockResolvedValueOnce(derivedInputs())
            .mockResolvedValueOnce(null)

        const { result } = renderHook(() => useListPasskeysForBackup())
        const passkeys = await result.current()

        expect(passkeys).toHaveLength(1)
        expect(passkeys[0].credentialId).toBe('a')
    })

    it('replaces the seed key id with the seed first-derived address', async () => {
        keystoreKeys.mockReturnValue([{ id: 'a' }])
        inputsFor.mockResolvedValue(derivedInputs())

        const { result } = renderHook(() => useListPasskeysForBackup())
        const [passkey] = await result.current()

        expect(backupSeedReferenceMock).toHaveBeenCalledWith('seed-1')
        expect(passkey.seedAddress).toBe('SEED-REF')
        expect('seedKeyId' in passkey).toBe(false)
    })

    it('caches the result in the proven-passkeys store', async () => {
        keystoreKeys.mockReturnValue([{ id: 'a' }])
        inputsFor.mockResolvedValue(derivedInputs())

        const { result } = renderHook(() => useListPasskeysForBackup())
        const passkeys = await result.current()

        expect(useProvenPasskeysStore.getState().provenPasskeys).toEqual(
            passkeys.map(({ privateKey: _privateKey, ...passkey }) => passkey),
        )
    })

    it('never puts a private key in the proven-passkeys store', async () => {
        keystoreKeys.mockReturnValue([{ id: 'a' }])
        inputsFor.mockResolvedValue(derivedInputs())

        const { result } = renderHook(() => useListPasskeysForBackup())
        await result.current()

        const [cached] = useProvenPasskeysStore.getState().provenPasskeys
        expect(cached).not.toHaveProperty('privateKey')
    })

    it('uses the key a record holds without touching the seed', async () => {
        keystoreKeys.mockReturnValue([{ id: 'a' }])
        const stored = new Uint8Array(32).fill(2)
        readPrivateKeyMock.mockResolvedValue(stored)
        storedInputsFor.mockReturnValue({
            ...derivedInputs(),
            seedKeyId: undefined,
            privateKey: stored,
        })

        const { result } = renderHook(() => useListPasskeysForBackup())
        const [passkey] = await result.current()

        expect(storedInputsFor).toHaveBeenCalledWith({ id: 'a' }, stored)
        expect(inputsFor).not.toHaveBeenCalled()
        expect(backupSeedReferenceMock).not.toHaveBeenCalled()
        expect(passkey!.privateKey).toBe(stored)
        expect(passkey!.seedAddress).toBeUndefined()
    })

    it('re-derives when the key a record holds does not match its public key', async () => {
        keystoreKeys.mockReturnValue([{ id: 'a' }])
        readPrivateKeyMock.mockResolvedValue(new Uint8Array(32).fill(2))
        storedInputsFor.mockReturnValue(null)
        inputsFor.mockResolvedValue(derivedInputs())

        const { result } = renderHook(() => useListPasskeysForBackup())
        const [passkey] = await result.current()

        expect(inputsFor).toHaveBeenCalledTimes(1)
        expect(passkey!.seedAddress).toBe('SEED-REF')
    })

    it('never reads a key for a keystore entry that is not a credential', async () => {
        keystoreKeys.mockReturnValue([{ id: 'seed-1' }])

        const { result } = renderHook(() => useListPasskeysForBackup())
        await result.current()

        expect(readPrivateKeyMock).not.toHaveBeenCalled()
        expect(disposeReaderMock).toHaveBeenCalledTimes(1)
    })

    // Proving each credential costs a 210k-iteration PBKDF2 over the same seed
    // entropy, and a user's credentials cluster on one wallet, so the sweep
    // reads the secret once and shares one main-key cache across the batch.
    it('reads a seed secret once for every credential that shares it, then zeroes it', async () => {
        keystoreKeys.mockReturnValue([
            { id: 'a' },
            { id: 'b' },
            { id: 'seed-1' },
        ])
        entropyChildIdOfMock.mockReturnValue('entropy-1')
        const entropy = new Uint8Array([1, 2, 3])
        withSecretMock.mockResolvedValue(entropy)
        inputsFor.mockImplementation(
            async (
                key: { id: string },
                resolveEntropy: (seedKeyId: string) => Promise<unknown>,
            ) => {
                await resolveEntropy('seed-1')
                return derivedInputs(key.id)
            },
        )

        const { result } = renderHook(() => useListPasskeysForBackup())
        await result.current()

        expect(withSecretMock).toHaveBeenCalledTimes(1)
        // One cache instance for the whole sweep, or every credential derives
        // its own main key.
        const caches = inputsFor.mock.calls
            .filter(call => call[0].id !== 'seed-1')
            .map(call => call[3])
        expect(caches).toHaveLength(2)
        expect(caches[0]).toBe(caches[1])
        expect(zeroBytesMock).toHaveBeenCalledWith(entropy)
    })

    it('never reads the entropy of a seed whose ACL denies the backup domain', async () => {
        keystoreKeys.mockReturnValue([{ id: 'a' }, { id: 'seed-1' }])
        entropyChildIdOfMock.mockReturnValue('entropy-1')
        withSecretMock.mockResolvedValue(new Uint8Array([1, 2, 3]))
        canAccessMock.mockReturnValue(false)
        let resolved: unknown
        inputsFor.mockImplementation(
            async (
                _key: { id: string },
                resolveEntropy: (seedKeyId: string) => Promise<unknown>,
            ) => {
                resolved = await resolveEntropy('seed-1')
                return null
            },
        )

        const { result } = renderHook(() => useListPasskeysForBackup())
        const passkeys = await result.current()

        expect(canAccessMock).toHaveBeenCalledWith(
            { id: 'seed-1' },
            'backup-flow',
        )
        expect(resolved).toBeNull()
        expect(withSecretMock).not.toHaveBeenCalled()
        expect(passkeys).toEqual([])
    })

    // A KMS read that throws for one seed is an expected failure, and the
    // keys other credentials already produced must not outlive it.
    it('zeroes every key already read when another credential fails', async () => {
        keystoreKeys.mockReturnValue([{ id: 'a' }, { id: 'b' }])
        const stored = new Uint8Array(32).fill(2)
        readPrivateKeyMock.mockImplementation(async id =>
            id === 'a' ? stored : null,
        )
        storedInputsFor.mockReturnValue({
            ...derivedInputs(),
            seedKeyId: undefined,
            privateKey: stored,
        })
        inputsFor.mockRejectedValue(new Error('KMS session denied'))

        const { result } = renderHook(() => useListPasskeysForBackup())

        await expect(result.current()).rejects.toThrow('KMS session denied')
        expect(zeroBytesMock).toHaveBeenCalledWith(stored)
        expect(disposeReaderMock).toHaveBeenCalledTimes(1)
    })

    it('hands metadata-only callers no keys and zeroes them before resolving', async () => {
        keystoreKeys.mockReturnValue([{ id: 'a' }])
        const derived = derivedInputs()
        inputsFor.mockResolvedValue(derived)

        const { result } = renderHook(() => useListPasskeyMetadataForBackup())
        const [passkey] = await result.current()

        expect(passkey).not.toHaveProperty('privateKey')
        expect(passkey!.credentialId).toBe('a')
        expect(zeroBytesMock).toHaveBeenCalledWith(derived.privateKey)
        expect(useProvenPasskeysStore.getState().provenPasskeys).toEqual([
            passkey,
        ])
    })
})
