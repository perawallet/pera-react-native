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
import type {
    ChainScope,
    PeraTransaction,
} from '@perawallet/wallet-core-chain-contract'

const mockSignTransactionsWithKey = vi.fn()
const mockGetPQSigningInfo = vi.fn()

vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<object>()),
    useKMS: () => ({
        signTransactionsWithKey: (...args: unknown[]) =>
            mockSignTransactionsWithKey(...args),
        getPQSigningInfo: mockGetPQSigningInfo,
    }),
}))

import { SIGNING_KEY_DOMAIN } from '../../constants'
import { registerFakeLocalKeySignerAdapter } from '../../__tests__/fakeLocalKeySignerAdapter'
import { useLocalKeyTransactionSigner } from '../useLocalKeyTransactionSigner'

const account = {
    address: 'ADDR',
    keyPairId: 'key-1',
    custody: { kind: 'local', seed: null },
} as unknown as WalletAccount
const group = [{ id: 'txn' }] as unknown as PeraTransaction[]
const ALGORAND_MAINNET: ChainScope = {
    chainId: 'algorand',
    networkId: 'mainnet',
}

describe('useLocalKeyTransactionSigner', () => {
    beforeEach(() => {
        mockSignTransactionsWithKey.mockReset()
    })

    test('hands the registered adapter the account, indexes and group it was given and returns its result', async () => {
        const signed = [{ txn: group[0], sig: new Uint8Array([1]) }]
        const adapter = registerFakeLocalKeySignerAdapter({
            signTransactions: vi.fn().mockResolvedValue(signed),
        })
        const { result } = renderHook(() => useLocalKeyTransactionSigner())

        const out = await result.current.signTransactions(
            group,
            [0],
            account,
            ALGORAND_MAINNET,
        )

        expect(out).toBe(signed)
        expect(adapter.signTransactions).toHaveBeenCalledWith(
            expect.anything(),
            group,
            [0],
            account,
        )
    })

    test('binds payload signing to the signing key domain and passes the PQ oracle through', async () => {
        mockSignTransactionsWithKey.mockResolvedValue([new Uint8Array([7])])
        const adapter = registerFakeLocalKeySignerAdapter({
            signTransactions: vi.fn().mockResolvedValue([]),
        })
        const { result } = renderHook(() => useLocalKeyTransactionSigner())

        await result.current.signTransactions(
            group,
            [0],
            account,
            ALGORAND_MAINNET,
        )

        const deps = vi.mocked(adapter.signTransactions).mock.calls[0][0]
        const payloads = [new Uint8Array([1])]
        await deps.signPayloads('key-1', payloads)
        expect(mockSignTransactionsWithKey).toHaveBeenCalledWith(
            'key-1',
            SIGNING_KEY_DOMAIN,
            payloads,
        )
        expect(deps.getPQSigningInfo).toBe(mockGetPQSigningInfo)
        expect(Object.keys(deps).sort()).toEqual([
            'getPQSigningInfo',
            'signPayloads',
        ])
    })

    test("signs with the scope chain's adapter, never another chain's", async () => {
        const { result } = renderHook(() => useLocalKeyTransactionSigner())

        await expect(
            result.current.signTransactions(group, [0], account, {
                chainId: 'ethereum',
                networkId: 'mainnet',
            }),
        ).rejects.toThrow(/No local-key signer adapter is registered/)
    })
})
