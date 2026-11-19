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

import { describe, test, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'

const SHARED = '0xshared'

const watch: WalletAccount = {
    id: 'watch',
    name: '',
    custody: { kind: 'watch' },
    chains: { base: { address: SHARED } },
} as WalletAccount

const hd: WalletAccount = {
    id: 'hd',
    name: '',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains: { ethereum: { address: SHARED, keyPairId: 'wallet-1' } },
} as WalletAccount

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAccountsStore: <T>(
            selector: (state: { accounts: WalletAccount[] }) => T,
        ) => selector({ accounts: [watch, hd] }),
    }
})

import { usePassphraseAccount } from '../usePassphraseAccount'

describe('usePassphraseAccount', () => {
    test('returns the account with the given id, not the first holding the address', () => {
        const { result } = renderHook(() => usePassphraseAccount(SHARED, 'hd'))

        expect(result.current).toBe(hd)
    })

    test('falls back to the first account holding the address without an id', () => {
        const { result } = renderHook(() => usePassphraseAccount(SHARED))

        expect(result.current).toBe(watch)
    })

    test('returns null for an id no account has', () => {
        const { result } = renderHook(() =>
            usePassphraseAccount(SHARED, 'missing'),
        )

        expect(result.current).toBeNull()
    })
})
