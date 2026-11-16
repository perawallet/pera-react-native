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

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { act, screen } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import {
    getAccountPortfolioTotals,
    insertAssetHolding,
    upsertAccountChainState,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    nativeAssetFor,
    upsertAssetPrices,
    upsertAssets,
    useAssetPreferencesStore,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { AccountOverviewModalContext } from '@modules/accounts/components/AccountOverview/AccountOverviewModalContext'
import { AccountAssetList } from '@modules/accounts/components/AccountAssetList'
import { useAssetListViewStore } from '@modules/accounts/hooks/useAssetListViewStore'
import { ETH_ADDRESS, ETH_SCOPE } from './__fixtures__/multichainHoldings'

// The integration setup registers whichever chains config enables.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

const TSLAX = '0x8aD3c73F833d3F9A523aB01476625F269aEB7Cf0'
const UNKNOWN = '0x2222222222222222222222222222222222222222'
const SPAM = '0x3333333333333333333333333333333333333333'
const PRICED_UNVERIFIED = '0x4444444444444444444444444444444444444444'

const ACCOUNT: WalletAccount = {
    id: 'eth-detected',
    custody: { kind: 'local', seed: null },
    chains: { ethereum: { address: ETH_ADDRESS, keyPairId: 'e-key' } },
    name: 'Eth main',
}

const token = (
    assetId: string,
    name: string,
    verificationTier: 'verified' | 'unverified' | 'suspicious',
): PeraAsset => ({
    ...nativeAssetFor('ethereum'),
    assetId,
    name,
    unitName: name.slice(0, 5).toUpperCase(),
    decimals: 18,
    peraMetadata: {
        isDeleted: false,
        verificationTier,
        isFavorited: false,
        isPriceAlertEnabled: false,
    },
})

// 0.00551 of a priced, vetted token the account received from a swap, plus an
// unknown token, a priced one Pera hasn't reviewed and a flagged one an airdrop
// left behind.
const seedReceivedTokens = async () => {
    const ether = nativeAssetFor('ethereum')
    await upsertAssets({
        items: [
            ether,
            token(TSLAX, 'Tesla xStock', 'verified'),
            token(UNKNOWN, 'Mystery Coin', 'unverified'),
            token(PRICED_UNVERIFIED, 'Plain Coin', 'unverified'),
            token(SPAM, 'Free Airdrop', 'suspicious'),
        ],
        scope: ETH_SCOPE,
    })
    await upsertAccountChainState({
        accountAddress: ETH_ADDRESS,
        scope: ETH_SCOPE,
        nativeBalance: new Decimal('1500000000000000000'),
        chainData: { family: 'evm', nonce: { latest: 0, pending: 0 } },
    })
    for (const [assetId, amount] of [
        [ether.assetId, '1500000000000000000'],
        [TSLAX, '5510000000000000'],
        [UNKNOWN, '1000000000000000000'],
        [PRICED_UNVERIFIED, '1000000000000000000'],
        [SPAM, '9000000000000000000'],
    ] as const) {
        await insertAssetHolding({
            accountAddress: ETH_ADDRESS,
            assetId,
            scope: ETH_SCOPE,
            amount: new Decimal(amount),
        })
    }
    await upsertAssetPrices({
        prices: [
            { assetId: ether.assetId, usdPrice: new Decimal('2000') },
            { assetId: TSLAX, usdPrice: new Decimal('357') },
            { assetId: PRICED_UNVERIFIED, usdPrice: new Decimal('4') },
        ],
        scope: ETH_SCOPE,
    })
}

const renderList = () =>
    renderWithNavigation(
        () => (
            <AccountOverviewModalContext.Provider
                value={{
                    account: ACCOUNT,
                    openSendFunds: vi.fn(),
                    openReceiveFunds: vi.fn(),
                    openReceiveFundsOn: vi.fn(),
                    openAccountOptions: vi.fn(),
                }}
            >
                <AccountAssetList account={ACCOUNT} />
            </AccountOverviewModalContext.Provider>
        ),
        'AccountAssetListHost',
    )

describe('Flow: tokens an Ethereum account received', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useRemoteConfigStore.getState().resetState()
        useAssetPreferencesStore.getState().resetState()
        useAssetListViewStore.setState({
            selectedChainId: null,
            expandedGroupIds: [],
        })
        useAccountsStore.getState().setAccounts([ACCOUNT])
        await seedReceivedTokens()
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
        useAssetPreferencesStore.getState().resetState()
    })

    it('Given a token received from a swap that Pera has vetted, when the list renders, then it is listed with its name, amount and fiat value and no contract address', async () => {
        renderList()

        const row = await screen.findByTestId(`asset_row_${TSLAX}`)

        expect(row.textContent).toContain('Tesla xStock')
        // A list row stops at 4 dp, rounding down.
        expect(row.textContent).toContain('0.0055 TESLA')
        expect(row.textContent).toContain('1.97')
        expect(row.textContent).not.toContain('0x8aD3')
    })

    it('Given a token Pera has not vetted, when the list renders, then it is listed with its contract address, its symbol on the amount and no fiat value', async () => {
        renderList()

        const row = await screen.findByTestId(`asset_row_${UNKNOWN}`)

        expect(row.textContent).toContain('MYSTE · 0x2222')
        expect(row.textContent).toContain('1.00 MYSTE')
        // No price: no value at all, not a placeholder.
        expect(row.textContent).not.toContain('---')
    })

    it('Given a priced token Pera has not vetted, when the list renders, then it shows its fiat value and the account total counts it', async () => {
        renderList()

        const row = await screen.findByTestId(`asset_row_${PRICED_UNVERIFIED}`)

        expect(row.textContent).toContain('4.00')
        const { nonNativeUsdValue } = await getAccountPortfolioTotals({
            accountAddress: ETH_ADDRESS,
            scope: ETH_SCOPE,
        })
        // 0.00551 * $357 from the vetted token, plus 1 * $4; the flagged token adds nothing.
        expect(nonNativeUsdValue.toNumber()).toBeCloseTo(0.00551 * 357 + 4, 4)
    })

    it('Given a token Pera flags as suspicious, when the list renders, then it is not listed', async () => {
        renderList()
        await screen.findByTestId(`asset_row_${TSLAX}`)

        expect(screen.queryByTestId(`asset_row_${SPAM}`)).toBeNull()
    })

    it('Given suspicious assets are switched on in the filters, when the list renders, then the flagged token is listed', async () => {
        act(() => {
            useAssetPreferencesStore.getState().setShowSuspicious(true)
        })

        renderList()

        expect(await screen.findByTestId(`asset_row_${SPAM}`)).toBeTruthy()
    })
})
