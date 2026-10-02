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
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'

const mockSignTransactionsWithKey = vi.fn()
const mockGetPQSigningInfo = vi.fn()
const encodeTransactionMock = vi.fn()
const networkMock = vi.fn(() => ({ network: 'mainnet' }))

vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<object>()),
    useKMS: () => ({
        signTransactionsWithKey: (...args: unknown[]) =>
            mockSignTransactionsWithKey(...args),
        getPQSigningInfo: mockGetPQSigningInfo,
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => ({
    ...(await importOriginal<object>()),
    useTransactionEncoder: () => ({
        encodeTransaction: encodeTransactionMock,
    }),
    useNetwork: () => networkMock(),
}))

import { SIGNING_KEY_DOMAIN } from '../../constants'
import { localKeySignerChainAdapters } from '../../chain-adapter'
import { registerFakeLocalKeySignerAdapter } from '../../__tests__/fakeLocalKeySignerAdapter'
import { useLocalKeyTransactionSigner } from '../useLocalKeyTransactionSigner'

const account = {
    address: 'ADDR',
    keyPairId: 'key-1',
    type: 'algo25',
} as unknown as WalletAccount
const group = [{ id: 'txn' }] as unknown as PeraTransaction[]

describe('useLocalKeyTransactionSigner', () => {
    beforeEach(() => {
        mockSignTransactionsWithKey.mockReset()
        networkMock.mockReturnValue({ network: 'mainnet' })
    })

    test('hands the registered adapter the account, indexes and group it was given and returns its result', async () => {
        const signed = [{ txn: group[0], sig: new Uint8Array([1]) }]
        const adapter = registerFakeLocalKeySignerAdapter({
            signTransactions: vi.fn().mockResolvedValue(signed),
        })
        const { result } = renderHook(() => useLocalKeyTransactionSigner())

        const out = await result.current.signTransactions(group, [0], account)

        expect(out).toBe(signed)
        expect(adapter.signTransactions).toHaveBeenCalledWith(
            expect.anything(),
            group,
            [0],
            account,
        )
    })

    test('binds payload signing to the signing key domain and passes the PQ oracle and encoder through', async () => {
        mockSignTransactionsWithKey.mockResolvedValue([new Uint8Array([7])])
        const adapter = registerFakeLocalKeySignerAdapter({
            signTransactions: vi.fn().mockResolvedValue([]),
        })
        const { result } = renderHook(() => useLocalKeyTransactionSigner())

        await result.current.signTransactions(group, [0], account)

        const deps = vi.mocked(adapter.signTransactions).mock.calls[0][0]
        const payloads = [new Uint8Array([1])]
        await deps.signPayloads('key-1', payloads)
        expect(mockSignTransactionsWithKey).toHaveBeenCalledWith(
            'key-1',
            SIGNING_KEY_DOMAIN,
            payloads,
        )
        expect(deps.getPQSigningInfo).toBe(mockGetPQSigningInfo)
        expect(deps.encodeTransaction).toBe(encodeTransactionMock)
    })

    test('rejects when no signer adapter is registered for the network chain', async () => {
        localKeySignerChainAdapters.reset()
        const { result } = renderHook(() => useLocalKeyTransactionSigner())

        await expect(
            result.current.signTransactions(group, [0], account),
        ).rejects.toThrow(/No local-key signer adapter is registered/)
    })
})
