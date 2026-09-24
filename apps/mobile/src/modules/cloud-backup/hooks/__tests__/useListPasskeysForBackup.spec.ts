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
import { useListPasskeysForBackup } from '../useListPasskeysForBackup'
import { useProvenPasskeysStore } from '@perawallet/wallet-core-backup'

const keystoreKeys = vi.fn().mockReturnValue([])
const inputsFor = vi.fn()
const getDerivedPublicKeyMock = vi.fn()
const entropyChildIdOfMock = vi.fn<() => string | undefined>()
const withSecretMock = vi.fn<() => Promise<Uint8Array | null>>()
const zeroBytesMock = vi.fn<(secret: Uint8Array) => void>()

vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    BIP32DerivationType: { Khovratovich: 32, Peikert: 9 },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    encodeAlgorandAddress: (pub: Uint8Array) => `ADDR-${pub[0]}`,
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    entropyChildIdOf: () => entropyChildIdOfMock(),
    withSecret: () => withSecretMock(),
    zeroBytes: (secret: Uint8Array) => zeroBytesMock(secret),
    useKMS: () => ({ getDerivedPublicKey: getDerivedPublicKeyMock }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => ({ state: { keys: keystoreKeys() } }),
}))

vi.mock('@perawallet/wallet-core-passkeys', () => ({
    passkeyBackupInputs: (...args: unknown[]) => inputsFor(...args),
}))

describe('useListPasskeysForBackup', () => {
    beforeEach(() => {
        act(() => useProvenPasskeysStore.getState().resetState())
        getDerivedPublicKeyMock
            .mockReset()
            .mockResolvedValue(new Uint8Array([9]))
        inputsFor.mockReset()
        entropyChildIdOfMock.mockReset().mockReturnValue(undefined)
        withSecretMock.mockReset().mockResolvedValue(null)
        zeroBytesMock.mockReset()
    })

    it('drops credentials that cannot be re-derived', async () => {
        keystoreKeys.mockReturnValue([{ id: 'a' }, { id: 'b' }])
        inputsFor
            .mockResolvedValueOnce({
                credentialId: 'a',
                origin: 'webauthn.io',
                identity: 'alice',
                counter: 0,
                publicKeySpkiDer: 'cHVi',
                seedKeyId: 'seed-1',
                createdAt: 1,
            })
            .mockResolvedValueOnce(null)

        const { result } = renderHook(() => useListPasskeysForBackup())
        const passkeys = await result.current()

        expect(passkeys).toHaveLength(1)
        expect(passkeys[0].credentialId).toBe('a')
    })

    it('replaces the seed key id with the seed first-derived address', async () => {
        keystoreKeys.mockReturnValue([{ id: 'a' }])
        inputsFor.mockResolvedValue({
            credentialId: 'a',
            origin: 'webauthn.io',
            identity: 'alice',
            counter: 0,
            publicKeySpkiDer: 'cHVi',
            seedKeyId: 'seed-1',
            createdAt: 1,
        })

        const { result } = renderHook(() => useListPasskeysForBackup())
        const [passkey] = await result.current()

        expect(getDerivedPublicKeyMock).toHaveBeenCalledWith('seed-1', 0, 0, 9)
        expect(passkey.seedAddress).toBe('ADDR-9')
        expect('seedKeyId' in passkey).toBe(false)
    })

    it('caches the result in the proven-passkeys store', async () => {
        keystoreKeys.mockReturnValue([{ id: 'a' }])
        inputsFor.mockResolvedValue({
            credentialId: 'a',
            origin: 'webauthn.io',
            identity: 'alice',
            counter: 0,
            publicKeySpkiDer: 'cHVi',
            seedKeyId: 'seed-1',
            createdAt: 1,
        })

        const { result } = renderHook(() => useListPasskeysForBackup())
        const passkeys = await result.current()

        expect(useProvenPasskeysStore.getState().provenPasskeys).toEqual(
            passkeys,
        )
    })

    // Proving each credential costs a 210k-iteration PBKDF2 over the same seed
    // entropy, and a user's credentials cluster on one wallet, so the sweep
    // reads the secret once and shares one main-key cache across the batch.
    it('reads a seed secret once for every credential that shares it, then zeroes it', async () => {
        keystoreKeys.mockReturnValue([{ id: 'a' }, { id: 'b' }])
        entropyChildIdOfMock.mockReturnValue('entropy-1')
        const entropy = new Uint8Array([1, 2, 3])
        withSecretMock.mockResolvedValue(entropy)
        inputsFor.mockImplementation(
            async (
                key: { id: string },
                resolveEntropy: (seedKeyId: string) => Promise<unknown>,
            ) => {
                await resolveEntropy('seed-1')
                return {
                    credentialId: key.id,
                    origin: 'webauthn.io',
                    identity: 'alice',
                    counter: 0,
                    publicKeySpkiDer: 'cHVi',
                    seedKeyId: 'seed-1',
                    createdAt: 1,
                }
            },
        )

        const { result } = renderHook(() => useListPasskeysForBackup())
        await result.current()

        expect(withSecretMock).toHaveBeenCalledTimes(1)
        // One cache instance for the whole sweep, or every credential derives
        // its own main key.
        const caches = inputsFor.mock.calls.map(call => call[3])
        expect(caches).toHaveLength(2)
        expect(caches[0]).toBe(caches[1])
        expect(zeroBytesMock).toHaveBeenCalledWith(entropy)
    })
})
