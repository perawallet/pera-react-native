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
    shownChainIds: ['algorand', 'ethereum'],
    isTestTier: false,
}
const mockUseAccountWithBalance = vi.fn(() => mockHookResult)
const mockAccountDisplay = vi.fn(
    (props: { secondaryAccessory?: ReactNode }) =>
        props.secondaryAccessory ?? null,
)
const mockPreferredAmount = vi.fn((_props: unknown) => null)
const mockPWBadge = vi.fn((_props: unknown) => undefined)
const mockNetworkIconStack = vi.fn((_props: unknown) => null)

vi.mock('../useAccountWithBalance', () => ({
    useAccountWithBalance: (...args: unknown[]) =>
        (mockUseAccountWithBalance as (...a: unknown[]) => unknown)(...args),
}))

vi.mock('@components/core', async () => {
    const actual =
        await vi.importActual<typeof import('@components/core')>(
            '@components/core',
        )
    return {
        ...actual,
        PWBadge: (props: Parameters<typeof actual.PWBadge>[0]) => {
            mockPWBadge(props)
            return actual.PWBadge(props)
        },
    }
})

vi.mock('@components/AccountDisplay', () => ({
    AccountDisplay: (props: { secondaryAccessory?: ReactNode }) =>
        mockAccountDisplay(props),
}))

vi.mock('@components/NetworkIconStack', () => ({
    NetworkIconStack: (props: unknown) => mockNetworkIconStack(props),
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
        mockPWBadge.mockClear()
        mockAccountDisplay.mockClear()
        mockNetworkIconStack.mockClear()
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

    it('shows no chain icons while every account is on one chain', () => {
        render(<AccountWithBalance account={ACCOUNT} />)

        expect(mockNetworkIconStack).not.toHaveBeenCalled()
    })

    it("shows the account's chains as icons once the wallet spans chains", () => {
        mockHookResult.isMultiChain = true

        render(<AccountWithBalance account={ACCOUNT} />)

        expect(mockNetworkIconStack).toHaveBeenCalledWith(
            expect.objectContaining({ chainIds: ['algorand', 'ethereum'] }),
        )
    })

    it("puts the chain icons and the tier badge on the account's secondary line, the badge cut to one line", () => {
        mockHookResult.isMultiChain = true
        mockHookResult.isTestTier = true

        render(<AccountWithBalance account={ACCOUNT} />)

        expect(mockAccountDisplay).toHaveBeenCalledWith(
            expect.objectContaining({
                secondaryAccessory: expect.anything(),
            }),
        )
        expect(mockNetworkIconStack).toHaveBeenCalled()
        expect(screen.getByText('common.network_label.testnet')).toBeTruthy()
        expect(mockPWBadge).toHaveBeenCalledWith(
            expect.objectContaining({
                textProps: expect.objectContaining({ numberOfLines: 1 }),
            }),
        )
    })

    it('leaves the secondary line to the account display on a single-chain mainnet wallet', () => {
        render(<AccountWithBalance account={ACCOUNT} />)

        expect(mockAccountDisplay).toHaveBeenCalledWith(
            expect.objectContaining({ secondaryAccessory: undefined }),
        )
    })

    it("replaces the balances with a notice when the chain's kill switch is off", () => {
        mockHookResult.availability = { isAvailable: false }

        render(<AccountWithBalance account={ACCOUNT} />)

        expect(screen.getByTestId('account_chain_unavailable')).toBeTruthy()
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
})
