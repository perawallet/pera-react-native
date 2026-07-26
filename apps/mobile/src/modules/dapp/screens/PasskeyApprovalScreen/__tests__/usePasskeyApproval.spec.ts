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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
    class SecurityError extends Error {
        constructor(message = 'bad rp id') {
            super(message)
            this.name = 'SecurityError'
        }
    }
    return {
        SecurityError,
        useDappRequest: vi.fn(),
        createCredential: vi.fn(),
        assertCredential: vi.fn(),
        deserializeCreateOptions: vi.fn(),
        deserializeGetOptions: vi.fn(),
        createKeystoreSigner: vi.fn(),
        getKeystoreStore: vi.fn(),
        resolvePasskey: vi.fn(),
        rejectPasskey: vi.fn(),
    }
})

vi.mock('../../../hooks/useDappRequest', () => ({
    useDappRequest: mocks.useDappRequest,
}))

vi.mock('@perawallet/wallet-core-passkeys', () => ({
    createCredential: mocks.createCredential,
    assertCredential: mocks.assertCredential,
    deserializeCreateOptions: mocks.deserializeCreateOptions,
    deserializeGetOptions: mocks.deserializeGetOptions,
    SecurityError: mocks.SecurityError,
}))

vi.mock('@perawallet/wallet-extension-keystore-chrome', () => ({
    createKeystoreSigner: mocks.createKeystoreSigner,
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: mocks.getKeystoreStore,
}))

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    resolvePasskey: mocks.resolvePasskey,
    rejectPasskey: mocks.rejectPasskey,
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { usePasskeyApproval } from '../usePasskeyApproval'

const CREATE_APPROVAL = {
    kind: 'passkey-create' as const,
    requestId: 'pk1',
    origin: 'https://webauthn.io',
    rpId: 'webauthn.io',
    userName: 'alice@example.com',
    options: { rp: { id: 'webauthn.io' } },
}

const GET_APPROVAL = {
    kind: 'passkey-get' as const,
    requestId: 'pk2',
    origin: 'https://webauthn.io',
    rpId: 'webauthn.io',
    options: { rpId: 'webauthn.io' },
}

const FAKE_STORE = { state: { keys: [] } }
const FAKE_SIGNER = { fake: 'signer' }
const DESERIALIZED_CREATE = { rp: { id: 'webauthn.io' }, deserialized: true }
const DESERIALIZED_GET = { rpId: 'webauthn.io', deserialized: true }
const SERIALIZED_CREDENTIAL = {
    id: 'cred',
    rawId: 'cred',
    type: 'public-key' as const,
    response: { clientDataJSON: 'CDJ', attestationObject: 'AO' },
}

describe('usePasskeyApproval', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(window, 'close').mockImplementation(() => {})
        mocks.getKeystoreStore.mockReturnValue(FAKE_STORE)
        mocks.createKeystoreSigner.mockReturnValue(FAKE_SIGNER)
        mocks.deserializeCreateOptions.mockReturnValue(DESERIALIZED_CREATE)
        mocks.deserializeGetOptions.mockReturnValue(DESERIALIZED_GET)
        mocks.createCredential.mockResolvedValue(SERIALIZED_CREDENTIAL)
        mocks.assertCredential.mockResolvedValue(SERIALIZED_CREDENTIAL)
        mocks.resolvePasskey.mockResolvedValue(undefined)
        mocks.rejectPasskey.mockResolvedValue(undefined)
    })

    it('exposes rpId, userName and origin from the pending passkey-create approval', () => {
        mocks.useDappRequest.mockReturnValue({
            requestId: 'pk1',
            approval: CREATE_APPROVAL,
            isLoading: false,
        })
        const { result } = renderHook(() => usePasskeyApproval())
        expect(result.current.rpId).toBe('webauthn.io')
        expect(result.current.userName).toBe('alice@example.com')
        expect(result.current.origin).toBe('https://webauthn.io')
        expect(result.current.isCreate).toBe(true)
    })

    it('approve() on a passkey-create approval deserializes options, builds the signer from the unlocked keystore, runs createCredential with the browser-stamped origin, and resolves', async () => {
        mocks.useDappRequest.mockReturnValue({
            requestId: 'pk1',
            approval: CREATE_APPROVAL,
            isLoading: false,
        })
        const { result } = renderHook(() => usePasskeyApproval())
        await act(async () => result.current.approve())

        expect(mocks.deserializeCreateOptions).toHaveBeenCalledWith(
            CREATE_APPROVAL.options,
        )
        expect(mocks.getKeystoreStore).toHaveBeenCalledTimes(1)
        expect(mocks.createKeystoreSigner).toHaveBeenCalledWith(FAKE_STORE)
        expect(mocks.createCredential).toHaveBeenCalledWith(
            DESERIALIZED_CREATE,
            FAKE_SIGNER,
            { origin: 'https://webauthn.io' },
        )
        expect(mocks.assertCredential).not.toHaveBeenCalled()
        expect(mocks.resolvePasskey).toHaveBeenCalledWith(
            'pk1',
            SERIALIZED_CREDENTIAL,
        )
        expect(mocks.rejectPasskey).not.toHaveBeenCalled()
        expect(window.close).toHaveBeenCalledTimes(1)
    })

    it('approve() on a passkey-get approval runs assertCredential instead of createCredential', async () => {
        mocks.useDappRequest.mockReturnValue({
            requestId: 'pk2',
            approval: GET_APPROVAL,
            isLoading: false,
        })
        const { result } = renderHook(() => usePasskeyApproval())
        await act(async () => result.current.approve())

        expect(mocks.deserializeGetOptions).toHaveBeenCalledWith(
            GET_APPROVAL.options,
        )
        expect(mocks.assertCredential).toHaveBeenCalledWith(
            DESERIALIZED_GET,
            FAKE_SIGNER,
            { origin: 'https://webauthn.io' },
        )
        expect(mocks.createCredential).not.toHaveBeenCalled()
        expect(mocks.resolvePasskey).toHaveBeenCalledWith(
            'pk2',
            SERIALIZED_CREDENTIAL,
        )
    })

    it('decline() rejects with "declined" and never calls the authenticator', async () => {
        mocks.useDappRequest.mockReturnValue({
            requestId: 'pk1',
            approval: CREATE_APPROVAL,
            isLoading: false,
        })
        const { result } = renderHook(() => usePasskeyApproval())
        await act(async () => result.current.decline())

        expect(mocks.rejectPasskey).toHaveBeenCalledWith('pk1', 'declined')
        expect(mocks.createCredential).not.toHaveBeenCalled()
        expect(mocks.resolvePasskey).not.toHaveBeenCalled()
        expect(window.close).toHaveBeenCalledTimes(1)
    })

    it('an authenticator error rejects with the error name and never leaves the request unsettled', async () => {
        mocks.useDappRequest.mockReturnValue({
            requestId: 'pk1',
            approval: CREATE_APPROVAL,
            isLoading: false,
        })
        mocks.createCredential.mockRejectedValueOnce(new mocks.SecurityError())
        const { result } = renderHook(() => usePasskeyApproval())
        await act(async () => result.current.approve())

        expect(mocks.rejectPasskey).toHaveBeenCalledWith('pk1', 'SecurityError')
        expect(mocks.resolvePasskey).not.toHaveBeenCalled()
        expect(result.current.error).toBeTruthy()
    })

    it('approve() is a no-op while the approval has not loaded yet', async () => {
        mocks.useDappRequest.mockReturnValue({
            requestId: null,
            approval: null,
            isLoading: true,
        })
        const { result } = renderHook(() => usePasskeyApproval())
        await act(async () => result.current.approve())

        expect(mocks.createCredential).not.toHaveBeenCalled()
        expect(mocks.resolvePasskey).not.toHaveBeenCalled()
        expect(mocks.rejectPasskey).not.toHaveBeenCalled()
    })
})
