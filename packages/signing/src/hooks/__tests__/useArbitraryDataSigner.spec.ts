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
import { useArbitraryDataSigner } from '../useArbitraryDataSigner'

const mockSignDataWithKey = vi.fn()

vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<object>()),
    useKMS: () => ({
        signDataWithKey: (...args: unknown[]) => mockSignDataWithKey(...args),
    }),
}))

const account = {
    address: 'ADDR',
    keyPairId: 'key-1',
    custody: { kind: 'local', seed: 'algo25' },
} as unknown as WalletAccount

describe('useArbitraryDataSigner', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSignDataWithKey.mockResolvedValue([new Uint8Array([9])])
    })

    test('hands the account and a flat item list to the registered signer', async () => {
        const signature = [new Uint8Array([1, 2, 3])]
        const signArbitraryData = vi.fn().mockResolvedValue(signature)
        registerFakeMessageSignerAdapter({ signArbitraryData })
        const { result } = renderHook(() => useArbitraryDataSigner())

        await expect(
            result.current.signArbitraryData(account, ['a', 'b']),
        ).resolves.toBe(signature)
        await result.current.signArbitraryData(account, 'single')

        expect(signArbitraryData).toHaveBeenNthCalledWith(
            1,
            expect.anything(),
            account,
            ['a', 'b'],
        )
        expect(signArbitraryData).toHaveBeenNthCalledWith(
            2,
            expect.anything(),
            account,
            ['single'],
        )
    })

    test('binds signPayloads to the KMS under the signing key domain', async () => {
        registerFakeMessageSignerAdapter({
            signArbitraryData: vi.fn(async (deps, acct) =>
                deps.signPayloads(acct.keyPairId!, [new Uint8Array([4])]),
            ),
        })
        const { result } = renderHook(() => useArbitraryDataSigner())

        await result.current.signArbitraryData(account, 'x')

        expect(mockSignDataWithKey).toHaveBeenCalledWith(
            'key-1',
            'pera.accounts',
            [new Uint8Array([4])],
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
