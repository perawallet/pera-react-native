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

import { beforeAll, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useAccountName } from '@hooks/useAccountName'
import { registerAlgorandAddressCodec } from '@test-utils/algorandAccountsAdapter'
import {
    accountForType,
    custodyForType,
    type AlgorandAccountKind,
} from '@test-utils/accountCustody'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, unknown>) =>
            params ? `${key} ${JSON.stringify(params)}` : key,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal =>
    importOriginal<typeof import('@perawallet/wallet-core-accounts')>(),
)

const ADDRESS = 'XYZ7MHAEQKWGVHKQWDN3QDCUFHP6DSRIZQDMBRBIDXUT5HUEMU3QT7LQ'
const ETHEREUM = 'ethereum' as ChainId
const ETHEREUM_ADDRESS = '0x52908400098527886E0F7030069857D2E4169EE7'

const numbered = (number: number) =>
    `account_info.account_number ${JSON.stringify({ number })}`

const hdAccount = (
    account: number,
    keyIndex: number,
    overrides: Partial<WalletAccount> = {},
): WalletAccount =>
    accountForType('hdWallet', ADDRESS, {
        custody: { kind: 'local', seed: 'bip39', hd: { account, keyIndex } },
        ...overrides,
    })

const nameOf = (account: WalletAccount | null) => {
    const { result } = renderHook(() => useAccountName())
    return result.current.getAccountName(account, LEGACY_CHAIN_ID)
}

describe('useAccountName', () => {
    beforeAll(() => {
        registerAlgorandAddressCodec()
    })

    it('numbers an unnamed Universal Wallet account by its place in the seed', () => {
        expect(nameOf(hdAccount(0, 0))).toBe(numbered(1))
        expect(nameOf(hdAccount(2, 0))).toBe(numbered(3))
    })

    it('numbers an unnamed Ledger account by its device account index', () => {
        const account = accountForType('hardware', ADDRESS, {
            custody: { ...custodyForType('hardware'), accountIndex: 1 },
        } as Partial<WalletAccount>)

        expect(nameOf(account)).toBe(numbered(2))
    })

    it('numbers an account named after its own address on another chain', () => {
        const account = hdAccount(1, 0, {
            name: '0x5290...9EE7',
            chains: {
                algorand: { address: ADDRESS, keyPairId: 'key' },
                [ETHEREUM]: { address: ETHEREUM_ADDRESS, keyPairId: 'key' },
            },
        })

        expect(nameOf(account)).toBe(numbered(2))
    })

    it('keeps a name the user gave', () => {
        expect(nameOf(hdAccount(0, 0, { name: 'Savings' }))).toBe('Savings')
    })

    it('numbers by the account alone, so first accounts of two wallets share a number', () => {
        const other = hdAccount(0, 0, { id: 'other-wallet-account' })

        expect(nameOf(hdAccount(0, 0))).toBe(nameOf(other))
    })

    it.each<AlgorandAccountKind>([
        'standalone',
        'watch',
        'multisig',
        'quantum',
    ])('shows the truncated address for an unnamed %s account', type => {
        expect(nameOf(accountForType(type, ADDRESS))).toBe(
            addressCodecs.get(LEGACY_CHAIN_ID).truncate(ADDRESS),
        )
    })

    it('reads "No Account" without an account', () => {
        expect(nameOf(null)).toBe('No Account')
    })
})
