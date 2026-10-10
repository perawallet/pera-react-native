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
    MessageRequest,
    SigningRequest,
} from '@perawallet/wallet-core-chain-contract'
import { registerFakeMessageSignerAdapter } from '../../__tests__/fakeMessageSignerAdapter'
import { messageSignerChainAdapters } from '../../message-signer'
import { CannotSignError } from '../../pipeline/errors'
import { useArbitraryDataSigner } from '../useArbitraryDataSigner'

const mockSignDataWithKey = vi.fn()

vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<object>()),
    useKMS: () => ({
        signDataWithKey: (...args: unknown[]) => mockSignDataWithKey(...args),
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-accounts')),
    useAllAccounts: () => [],
}))

const account = {
    address: 'ADDR',
    keyPairId: 'key-1',
    custody: { kind: 'local', seed: null },
} as unknown as WalletAccount

const planFor = vi.fn((request: MessageRequest): SigningRequest[] => [
    {
        requestIndex: 0,
        signer: request.signer,
        scheme: 'ed25519',
        payload: new TextEncoder().encode(
            (request.payload as { data: string }).data,
        ),
    },
])

describe('useArbitraryDataSigner', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSignDataWithKey.mockImplementation(
            async (_key, _domain, payloads: Uint8Array[]) =>
                payloads.map((_, index) => new Uint8Array([index + 1])),
        )
    })

    test('plans one arbitrary-data request per item, naming the account, and returns the signatures in order', async () => {
        const adapter = registerFakeMessageSignerAdapter({
            plan: planFor,
            assemble: vi.fn((request, signatures) => ({
                scope: request.scope,
                signature: signatures[0],
            })),
        })
        const { result } = renderHook(() => useArbitraryDataSigner())

        const signatures = await result.current.signArbitraryData(account, [
            'a',
            'b',
        ])
        await result.current.signArbitraryData(account, 'single')

        expect(signatures).toEqual([new Uint8Array([1]), new Uint8Array([2])])
        expect(adapter.plan).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                method: 'arbitrary-data',
                signer: 'ADDR',
                payload: { data: 'a' },
            }),
            { account, accounts: [] },
        )
        expect(adapter.plan).toHaveBeenNthCalledWith(
            3,
            expect.objectContaining({ payload: { data: 'single' } }),
            expect.anything(),
        )
    })

    test('signs every payload in one KMS call under the signing key domain', async () => {
        registerFakeMessageSignerAdapter({
            plan: planFor,
            assemble: vi.fn((request, signatures) => ({
                scope: request.scope,
                signature: signatures[0],
            })),
        })
        const { result } = renderHook(() => useArbitraryDataSigner())

        await result.current.signArbitraryData(account, ['a', 'b'])

        expect(mockSignDataWithKey).toHaveBeenCalledTimes(1)
        expect(mockSignDataWithKey).toHaveBeenCalledWith(
            'key-1',
            'pera.accounts',
            [new TextEncoder().encode('a'), new TextEncoder().encode('b')],
        )
    })

    test('refuses and never touches the KMS when no message signer is registered', async () => {
        messageSignerChainAdapters.reset()
        const { result } = renderHook(() => useArbitraryDataSigner())

        await expect(
            result.current.signArbitraryData(account, 'x'),
        ).rejects.toBeInstanceOf(CannotSignError)
        expect(mockSignDataWithKey).not.toHaveBeenCalled()
    })
})
