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

import { render, screen } from '@test-utils/render'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { AccountWithBalance } from '../AccountWithBalance'

const mockHookResult = {
    scope: { chainId: 'algorand', networkId: 'mainnet' },
    chainName: 'Algorand',
    availability: { isAvailable: true, nativeAsset: { assetId: '0' } } as
        | { isAvailable: true; nativeAsset: { assetId: string } }
        | { isAvailable: false },
    nativeValue: undefined,
    isMultiChain: false,
    isTestTier: false,
}

vi.mock('../useAccountWithBalance', () => ({
    useAccountWithBalance: () => mockHookResult,
}))

vi.mock('@components/AccountDisplay', () => ({
    AccountDisplay: () => null,
}))

vi.mock('@components/AssetAmount', () => ({
    AssetAmount: () => null,
}))

vi.mock('@components/PreferredAmount', () => ({
    PreferredAmount: () => null,
}))

const ACCOUNT: WalletAccount = {
    id: 'account-1',
    custody: { kind: 'watch' },
    chains: { algorand: { address: 'A'.repeat(58) } },
}

describe('AccountWithBalance', () => {
    beforeEach(() => {
        mockHookResult.isTestTier = false
        mockHookResult.isMultiChain = false
        mockHookResult.availability = {
            isAvailable: true,
            nativeAsset: { assetId: '0' },
        }
    })

    it('marks an account holding test funds with the tier badge', () => {
        mockHookResult.isTestTier = true

        render(<AccountWithBalance account={ACCOUNT} />)

        expect(screen.getByText('common.network_label.testnet')).toBeTruthy()
    })

    it('shows no tier badge for an account on a mainnet network', () => {
        render(<AccountWithBalance account={ACCOUNT} />)

        expect(screen.queryByText('common.network_label.testnet')).toBeNull()
    })

    it('shows no chain badge while every account is on one chain', () => {
        render(<AccountWithBalance account={ACCOUNT} />)

        expect(screen.queryByText('Algorand')).toBeNull()
    })

    it("shows the account's chain once the wallet spans chains", () => {
        mockHookResult.isMultiChain = true

        render(<AccountWithBalance account={ACCOUNT} />)

        expect(screen.getByText('Algorand')).toBeTruthy()
    })

    it("replaces the balances with a notice when the chain's kill switch is off", () => {
        mockHookResult.availability = { isAvailable: false }

        render(<AccountWithBalance account={ACCOUNT} />)

        expect(screen.getByTestId('account_chain_unavailable')).toBeTruthy()
    })
})
