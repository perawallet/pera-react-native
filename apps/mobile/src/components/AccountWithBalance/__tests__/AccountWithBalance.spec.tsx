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

import type { ReactNode } from 'react'
import { render, screen, within } from '@test-utils/render'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { PWView } from '@components/core'
import { AccountWithBalance } from '../AccountWithBalance'

const mockHookResult = {
    scope: { chainId: 'algorand', networkId: 'mainnet' },
    chainName: 'Algorand',
    availability: { isAvailable: true, nativeAsset: { assetId: '0' } } as
        | { isAvailable: true; nativeAsset: { assetId: string } }
        | { isAvailable: false },
    nativeValue: undefined,
    preferredValue: undefined as Decimal | null | undefined,
    isMultiChain: false,
    isTestTier: false,
}
const mockUseAccountWithBalance = vi.fn(() => mockHookResult)
const mockAccountDisplay = vi.fn((_props: unknown) => null)
const mockPreferredAmount = vi.fn((_props: unknown) => null)

vi.mock('../useAccountWithBalance', () => ({
    useAccountWithBalance: (...args: unknown[]) =>
        (mockUseAccountWithBalance as (...a: unknown[]) => unknown)(...args),
}))

vi.mock('@components/AccountDisplay', () => ({
    AccountDisplay: (props: { badges?: ReactNode }) => {
        mockAccountDisplay(props)
        return <PWView testID='account_display'>{props.badges}</PWView>
    },
}))

vi.mock('@components/AssetAmount', () => ({
    AssetAmount: () => null,
}))

vi.mock('@components/PreferredAmount', () => ({
    PreferredAmount: (props: unknown) => mockPreferredAmount(props),
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
        mockHookResult.preferredValue = undefined
        mockPreferredAmount.mockClear()
        mockHookResult.availability = {
            isAvailable: true,
            nativeAsset: { assetId: '0' },
        }
    })

    it('marks an account holding test funds with the tier badge, under its name', () => {
        mockHookResult.isTestTier = true

        render(<AccountWithBalance account={ACCOUNT} />)

        expect(
            within(screen.getByTestId('account_display')).getByText(
                'common.network_label.testnet',
            ),
        ).toBeTruthy()
    })

    it('puts both the chain and the tier badge under the name', () => {
        mockHookResult.isMultiChain = true
        mockHookResult.isTestTier = true

        render(<AccountWithBalance account={ACCOUNT} />)

        const accountDisplay = within(screen.getByTestId('account_display'))
        expect(accountDisplay.getByText('Algorand')).toBeTruthy()
        expect(
            accountDisplay.getByText('common.network_label.testnet'),
        ).toBeTruthy()
    })

    it('passes no badges to a single-chain mainnet row', () => {
        mockAccountDisplay.mockClear()

        render(<AccountWithBalance account={ACCOUNT} />)

        expect(mockAccountDisplay).toHaveBeenCalledWith(
            expect.objectContaining({ badges: undefined }),
        )
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

        expect(
            within(screen.getByTestId('account_display')).getByText(
                'Algorand',
            ),
        ).toBeTruthy()
    })

    it("replaces the balances with a notice when the chain's kill switch is off, keeping the badges under the name", () => {
        mockHookResult.availability = { isAvailable: false }
        mockHookResult.isTestTier = true

        render(<AccountWithBalance account={ACCOUNT} />)

        expect(screen.getByTestId('account_chain_unavailable')).toBeTruthy()
        expect(
            within(screen.getByTestId('account_display')).getByText(
                'common.network_label.testnet',
            ),
        ).toBeTruthy()
    })

    it('hands its chain to the hook and the account display, and the hook scope to the fiat amount', () => {
        render(
            <AccountWithBalance
                account={ACCOUNT}
                chainId='ethereum'
            />,
        )

        expect(mockUseAccountWithBalance).toHaveBeenCalledWith(
            ACCOUNT,
            'ethereum',
        )
        expect(mockAccountDisplay).toHaveBeenCalledWith(
            expect.objectContaining({ chainId: 'ethereum' }),
        )
        expect(mockPreferredAmount).toHaveBeenCalledWith(
            expect.objectContaining({
                scope: mockHookResult.scope,
                sourceAssetId: '0',
            }),
        )
    })

    it("shows a multi-chain row's own fiat value rather than re-pricing its native balance", () => {
        mockHookResult.isMultiChain = true
        mockHookResult.preferredValue = null

        render(<AccountWithBalance account={ACCOUNT} />)

        const props = mockPreferredAmount.mock.calls.at(-1)?.[0]
        expect(props).toMatchObject({ value: null })
        expect(props).not.toHaveProperty('sourceAmount')
    })

    it('converts the native balance on a single-chain row', () => {
        mockHookResult.preferredValue = new Decimal(5)

        render(<AccountWithBalance account={ACCOUNT} />)

        const props = mockPreferredAmount.mock.calls.at(-1)?.[0]
        expect(props).toHaveProperty('sourceAmount')
        expect(props).not.toHaveProperty('value')
    })
})
