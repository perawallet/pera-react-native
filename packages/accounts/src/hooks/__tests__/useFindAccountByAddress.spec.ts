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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFindAccountByAddress } from '../useFindAccountByAddress'
import { useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'
import {
    buildTestAccount,
    TEST_CUSTODY,
    testAccount,
} from '../../__tests__/accountFactory'
import {
    fakeAccountsChain,
    MAINNET_SCOPE,
} from '../../__tests__/fakeAccountsChain'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: createMockPersistStorage,
    }
})

describe('useFindAccountByAddress', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
    })

    test('finds the account holding the address on the scope', () => {
        const accounts: WalletAccount[] = [
            testAccount('local', 'A', { id: '1' }),
            testAccount('local', 'B', { id: '2' }),
        ]
        useAccountsStore.setState({ accounts })

        const { result } = renderHook(() =>
            useFindAccountByAddress('A', MAINNET_SCOPE),
        )
        expect(result.current).toBe(accounts[0])

        const { result: missing } = renderHook(() =>
            useFindAccountByAddress('C', MAINNET_SCOPE),
        )
        expect(missing.current).toBeNull()
    })

    test('does not match an equal address string held on another chain', () => {
        const onOther = buildTestAccount(
            TEST_CUSTODY.watch,
            { ethereum: { address: 'SAME' } },
            { id: 'other' },
        )
        const onFake = testAccount('watch', 'SAME', { id: 'fake' })
        useAccountsStore.setState({ accounts: [onOther] })

        const { result, rerender } = renderHook(() =>
            useFindAccountByAddress('SAME', MAINNET_SCOPE),
        )
        expect(result.current).toBeNull()

        useAccountsStore.setState({ accounts: [onOther, onFake] })
        rerender()
        expect(result.current).toBe(onFake)
    })

    test("compares through the chain's codec", () => {
        fakeAccountsChain().codec.areEqual = (a, b) =>
            a.toLowerCase() === b.toLowerCase()
        const account = testAccount('watch', 'MIXED')
        useAccountsStore.setState({ accounts: [account] })

        const { result } = renderHook(() =>
            useFindAccountByAddress('mixed', MAINNET_SCOPE),
        )

        expect(result.current).toBe(account)
    })

    test('handles an empty store', () => {
        const { result } = renderHook(() =>
            useFindAccountByAddress('A', MAINNET_SCOPE),
        )
        expect(result.current).toBeNull()
    })
})
