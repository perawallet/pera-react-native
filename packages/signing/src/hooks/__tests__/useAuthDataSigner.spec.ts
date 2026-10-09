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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { registerFakeMessageSignerAdapter } from '../../__tests__/fakeMessageSignerAdapter'
import { messageSignerChainAdapters } from '../../message-signer'
import { CannotSignError } from '../../pipeline/errors'
import type { AuthData, AuthDataMetadata } from '../../pipeline/types'
import { useAuthDataSigner } from '../useAuthDataSigner'

const mockSignDataWithKey = vi.fn()
// Stable reference across renders: only the `accounts` dependency may force a
// callback rebuild, so the stale-list test actually guards the dep array.
const mockStableSignData = (...args: unknown[]) => mockSignDataWithKey(...args)

vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<object>()),
    useKMS: () => ({ signDataWithKey: mockStableSignData }),
}))

let mockAccounts: WalletAccount[] = []

vi.mock('@perawallet/wallet-core-accounts', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-accounts')),
    useAllAccounts: () => mockAccounts,
}))

const account = {
    address: 'ADDR',
    keyPairId: 'key-1',
    custody: { kind: 'local', seed: 'algo25' },
} as unknown as WalletAccount

const authData: AuthData = {
    data: 'ZGF0YQ==',
    signer: 'ADDR',
    domain: 'example.io',
    authenticatorData: new Uint8Array(37),
}
const metadata: AuthDataMetadata = { scope: 1, encoding: 'base64' }

describe('useAuthDataSigner', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAccounts = []
        mockSignDataWithKey.mockResolvedValue([new Uint8Array([9])])
    })

    test('hands the request and the current accounts to the registered signer', async () => {
        const signature = new Uint8Array([1, 2, 3])
        const signAuthData = vi.fn().mockResolvedValue(signature)
        registerFakeMessageSignerAdapter({ signAuthData })
        mockAccounts = [account]
        const { result } = renderHook(() => useAuthDataSigner())

        await expect(
            result.current.signAuthData(account, authData, metadata),
        ).resolves.toBe(signature)

        expect(signAuthData).toHaveBeenCalledWith(
            expect.anything(),
            account,
            authData,
            metadata,
            [account],
        )
    })

    test('binds signPayloads to the KMS under the signing key domain', async () => {
        registerFakeMessageSignerAdapter({
            signAuthData: vi.fn(async (deps, acct) => {
                const [sig] = await deps.signPayloads(acct.keyPairId!, [
                    new Uint8Array([4]),
                ])
                return sig
            }),
        })
        const { result } = renderHook(() => useAuthDataSigner())

        await result.current.signAuthData(account, authData, metadata)

        expect(mockSignDataWithKey).toHaveBeenCalledWith(
            'key-1',
            'pera.accounts',
            [new Uint8Array([4])],
        )
    })

    test('passes the accounts current at call time, not at first render', async () => {
        const signAuthData = vi.fn().mockResolvedValue(new Uint8Array())
        registerFakeMessageSignerAdapter({ signAuthData })
        mockAccounts = [account]
        const { result, rerender } = renderHook(() => useAuthDataSigner())

        const revoked = { ...account, rekeyAddress: undefined }
        mockAccounts = [revoked]
        rerender()
        await result.current.signAuthData(account, authData, metadata)

        expect(signAuthData.mock.calls[0][4]).toEqual([revoked])
    })

    test('refuses and never touches the KMS when no message signer is registered', async () => {
        messageSignerChainAdapters.reset()
        const { result } = renderHook(() => useAuthDataSigner())

        await expect(
            result.current.signAuthData(account, authData, metadata),
        ).rejects.toBeInstanceOf(CannotSignError)
        expect(mockSignDataWithKey).not.toHaveBeenCalled()
    })
})
