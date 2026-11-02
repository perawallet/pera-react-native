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
import type { CrossChainTotal } from '../useAccountWithBalance'

const mockHookResult = {
    scope: { chainId: 'algorand', networkId: 'mainnet' },
    chainName: 'Algorand',
    availability: { isAvailable: true, nativeAsset: { assetId: '0' } } as
        | { isAvailable: true; nativeAsset: { assetId: string } }
        | { isAvailable: false },
    nativeValue: undefined,
    preferredValue: undefined as Decimal | null | undefined,
    isMultiChain: false,
    crossChainTotal: undefined as CrossChainTotal | undefined,
    singleNetworkChainId: undefined as string | undefined,
    jointParticipantCount: undefined as number | undefined,
}
const mockUseAccountWithBalance = vi.fn(() => mockHookResult)
const mockAccountDisplay = vi.fn((_props: unknown) => null)
const mockPreferredAmount = vi.fn((_props: unknown) => null)
const mockAssetAmount = vi.fn((_props: unknown) => null)

vi.mock('../useAccountWithBalance', () => ({
    useAccountWithBalance: (...args: unknown[]) =>
        (mockUseAccountWithBalance as (...a: unknown[]) => unknown)(...args),
}))

vi.mock('@components/AccountDisplay', () => ({
    AccountDisplay: (props: {
        badges?: ReactNode
        secondaryContent?: ReactNode
        avatarBadge?: ReactNode
    }) => {
        mockAccountDisplay(props)
        return (
            <PWView testID='account_display'>
                {props.badges}
                {props.secondaryContent}
                <PWView testID='account_avatar_badge'>
                    {props.avatarBadge}
                </PWView>
            </PWView>
        )
    },
}))

vi.mock('@modules/chain-ui/icon', () => ({
    ChainLabel: ({ chainId }: { chainId: string }) => (
        <PWView testID={`chain_label_${chainId}`} />
    ),
}))

vi.mock('@components/AssetAmount', () => ({
    AssetAmount: (props: unknown) => mockAssetAmount(props),
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
        mockHookResult.isMultiChain = false
        mockHookResult.preferredValue = undefined
        mockHookResult.crossChainTotal = undefined
        mockHookResult.singleNetworkChainId = undefined
        mockHookResult.jointParticipantCount = undefined
        mockPreferredAmount.mockClear()
        mockAssetAmount.mockClear()
        mockAccountDisplay.mockClear()
        mockHookResult.availability = {
            isAvailable: true,
            nativeAsset: { assetId: '0' },
        }
    })

    it('puts the chain badge under the name once the wallet spans chains', () => {
        mockHookResult.isMultiChain = true

        render(<AccountWithBalance account={ACCOUNT} />)

        expect(
            within(screen.getByTestId('account_display')).getByText('Algorand'),
        ).toBeTruthy()
    })

    it('passes no badges to a single-chain mainnet row', () => {
        render(<AccountWithBalance account={ACCOUNT} />)

        expect(mockAccountDisplay).toHaveBeenCalledWith(
            expect.objectContaining({ badges: undefined }),
        )
    })

    it("replaces the balances with a notice when the chain's kill switch is off, keeping the chain badge under the name", () => {
        mockHookResult.availability = { isAvailable: false }
        mockHookResult.isMultiChain = true

        render(<AccountWithBalance account={ACCOUNT} />)

        expect(screen.getByTestId('account_chain_unavailable')).toBeTruthy()
        expect(
            within(screen.getByTestId('account_display')).getByText('Algorand'),
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

    describe('chain-agnostic row', () => {
        beforeEach(() => {
            mockHookResult.isMultiChain = true
        })

        it("shows the account's type and cross-chain total, not one chain's badge, address or native balance", () => {
            const total = new Decimal(42)
            mockHookResult.crossChainTotal = { kind: 'fiat', value: total }

            render(<AccountWithBalance account={ACCOUNT} />)

            expect(screen.queryByText('Algorand')).toBeNull()
            expect(mockAccountDisplay).toHaveBeenCalledWith(
                expect.objectContaining({
                    alwaysShowAccountType: true,
                    badges: undefined,
                }),
            )
            expect(mockAssetAmount).not.toHaveBeenCalled()
            expect(mockPreferredAmount).toHaveBeenCalledWith(
                expect.objectContaining({ value: total }),
            )
        })

        it('shows the network a single-network watch account sits on under its name, in place of the type', () => {
            mockHookResult.crossChainTotal = { kind: 'fiat', value: undefined }
            mockHookResult.singleNetworkChainId = 'ethereum'

            render(<AccountWithBalance account={ACCOUNT} />)

            expect(screen.getByTestId('chain_label_ethereum')).toBeTruthy()
        })

        it('shows no network line when the account has no single network', () => {
            mockHookResult.crossChainTotal = { kind: 'fiat', value: undefined }

            render(<AccountWithBalance account={ACCOUNT} />)

            expect(screen.queryByTestId('chain_label_ethereum')).toBeNull()
        })

        it("badges a joint account's avatar with its member count", () => {
            mockHookResult.crossChainTotal = { kind: 'fiat', value: undefined }
            mockHookResult.jointParticipantCount = 3

            render(<AccountWithBalance account={ACCOUNT} />)

            expect(
                within(screen.getByTestId('account_avatar_badge')).getByText(
                    '3',
                ),
            ).toBeTruthy()
        })

        it('shows no avatar badge for an account that is not joint', () => {
            mockHookResult.crossChainTotal = { kind: 'fiat', value: undefined }

            render(<AccountWithBalance account={ACCOUNT} />)

            expect(
                within(screen.getByTestId('account_avatar_badge')).queryByText(
                    /\d/,
                ),
            ).toBeNull()
        })

        it('shows no value and no tier badge when every chain is on a test network', () => {
            mockHookResult.crossChainTotal = { kind: 'testOnly' }

            render(<AccountWithBalance account={ACCOUNT} />)

            expect(
                screen.queryByText('common.network_label.testnet'),
            ).toBeNull()
            expect(mockPreferredAmount).not.toHaveBeenCalled()
            expect(mockAssetAmount).not.toHaveBeenCalled()
        })

        it("shows the unavailable notice when all of the account's chains are switched off", () => {
            mockHookResult.crossChainTotal = { kind: 'unavailable' }

            render(<AccountWithBalance account={ACCOUNT} />)

            expect(screen.getByTestId('account_chain_unavailable')).toBeTruthy()
            expect(mockPreferredAmount).not.toHaveBeenCalled()
        })
    })
})
