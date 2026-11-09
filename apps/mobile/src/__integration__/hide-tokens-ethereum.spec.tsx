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
import {
    act,
    cleanup,
    fireEvent,
    screen,
    waitFor,
} from '@testing-library/react'
import { Decimal } from 'decimal.js'
import {
    addToAssetHolding,
    getAccountPortfolioTotals,
    insertAssetHolding,
    setSelectedAccountId,
    upsertAccountChainState,
    useAccountsStore,
    useHiddenTokensInvalidation,
    useHiddenTokensStore,
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
import { HideTokensScreen } from '@modules/accounts/screens/HideTokensScreen'
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

const TSLAX = '0x8aD3c73F833d3F9A523aB01476625F269aEb7Cf0'
const PVC = '0x514B0000000000000000000000000000000046ca'
const SPAM = '0x3333333333333333333333333333333333333333'

const ACCOUNT: WalletAccount = {
    id: 'eth-hide',
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

// A priced token from a swap, an airdrop Pera hasn't vetted that the account
// holds a million of, and one it flags as spam.
const seed = async () => {
    const ether = nativeAssetFor('ethereum')
    await upsertAssets({
        items: [
            ether,
            token(TSLAX, 'Tesla xStock', 'verified'),
            token(PVC, 'Privacy Coin', 'unverified'),
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
        [PVC, '1000000000000000000000000'],
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
        ],
        scope: ETH_SCOPE,
    })
}

// What the app shell mounts beside its screens.
const HideTokensHost = () => {
    useHiddenTokensInvalidation()
    return <HideTokensScreen />
}

const renderHideTokens = () =>
    renderWithNavigation(HideTokensHost, 'HideTokensHost')

// What the app shell mounts beside its screens: the list refreshes through it.
const ListHost = () => {
    useHiddenTokensInvalidation()
    return (
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
    )
}

const renderList = () => renderWithNavigation(ListHost, 'AccountAssetListHost')

const setHidden = (assetId: string, isHidden: boolean): void => {
    act(() => {
        useHiddenTokensStore.getState().setTokenHidden({
            address: ETH_ADDRESS,
            scope: ETH_SCOPE,
            assetId,
            isHidden,
        })
    })
}

const nonNativeUsd = async () =>
    (
        await getAccountPortfolioTotals({
            accountAddress: ETH_ADDRESS,
            scope: ETH_SCOPE,
        })
    ).nonNativeUsdValue.toNumber()

describe('Flow: hiding a token an Ethereum account holds', () => {
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
        useHiddenTokensStore.getState().resetState()
        useAssetListViewStore.setState({
            selectedChainId: null,
            expandedGroupIds: [],
        })
        useAccountsStore.getState().setAccounts([ACCOUNT])
        setSelectedAccountId(ACCOUNT.id)
        await seed()
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
        useAssetPreferencesStore.getState().resetState()
        useHiddenTokensStore.getState().resetState()
    })

    it('Given an unvetted token with a balance, when the user hides it on the Hide Tokens screen, then it moves under Hidden Tokens and the asset list stops showing it', async () => {
        renderHideTokens()
        const toggle = await screen.findByTestId(`hide_tokens_toggle_${PVC}`)
        expect(toggle.textContent).toContain('token_visibility.hide_action')

        fireEvent.click(toggle)

        await waitFor(() =>
            expect(
                screen.getByTestId(`hide_tokens_toggle_${PVC}`).textContent,
            ).toContain('token_visibility.unhide_action'),
        )
        expect(screen.getByTestId('hide_tokens_screen').textContent).toContain(
            'hide_tokens.hidden_section',
        )
        cleanup()
        renderList()
        expect(await screen.findByTestId(`asset_row_${TSLAX}`)).toBeTruthy()
        expect(screen.queryByTestId(`asset_row_${PVC}`)).toBeNull()
    })

    it('Given the asset list is on screen, when a token is hidden through the store, then its row leaves the mounted list without a remount, and returns when unhidden', async () => {
        renderList()
        expect(await screen.findByTestId(`asset_row_${PVC}`)).toBeTruthy()

        setHidden(PVC, true)

        await waitFor(() =>
            expect(screen.queryByTestId(`asset_row_${PVC}`)).toBeNull(),
        )
        expect(screen.getByTestId(`asset_row_${TSLAX}`)).toBeTruthy()

        setHidden(PVC, false)

        expect(await screen.findByTestId(`asset_row_${PVC}`)).toBeTruthy()
    })

    it('Given suspicious assets are off, when Hide Tokens opens, then the flagged token sits under Hidden Tokens with no toggle and says why', async () => {
        renderHideTokens()

        const note = await screen.findByTestId(`hide_tokens_filtered_${SPAM}`)

        expect(note.textContent).toContain('token_visibility.filtered_note')
        expect(screen.queryByTestId(`hide_tokens_toggle_${SPAM}`)).toBeNull()
        expect(screen.getByTestId(`hide_tokens_toggle_${PVC}`)).toBeTruthy()
        expect(screen.getByTestId('hide_tokens_screen').textContent).toContain(
            'hide_tokens.hidden_section',
        )
    })

    it('Given suspicious assets are switched on, when Hide Tokens opens, then the flagged token is under Tokens with a Hide toggle', async () => {
        act(() => useAssetPreferencesStore.getState().setShowSuspicious(true))

        renderHideTokens()

        expect(
            (await screen.findByTestId(`hide_tokens_toggle_${SPAM}`))
                .textContent,
        ).toContain('token_visibility.hide_action')
        expect(screen.queryByTestId(`hide_tokens_filtered_${SPAM}`)).toBeNull()
    })

    it('Given a hidden token, when the user unhides it, then the asset list shows it again', async () => {
        setHidden(PVC, true)
        renderHideTokens()

        fireEvent.click(await screen.findByTestId(`hide_tokens_toggle_${PVC}`))

        await waitFor(() =>
            expect(
                screen.getByTestId(`hide_tokens_toggle_${PVC}`).textContent,
            ).toContain('token_visibility.hide_action'),
        )
        cleanup()
        renderList()
        expect(await screen.findByTestId(`asset_row_${PVC}`)).toBeTruthy()
    })

    it('Given suspicious assets are switched on, when a suspicious token is hidden, then it stays out of the list, and unhiding lists it', async () => {
        act(() => useAssetPreferencesStore.getState().setShowSuspicious(true))
        setHidden(SPAM, true)

        renderList()
        await screen.findByTestId(`asset_row_${TSLAX}`)
        expect(screen.queryByTestId(`asset_row_${SPAM}`)).toBeNull()
        cleanup()

        setHidden(SPAM, false)
        renderList()
        expect(await screen.findByTestId(`asset_row_${SPAM}`)).toBeTruthy()
    })

    it('Given a priced token, when the user hides it, then the account total no longer counts it', async () => {
        expect(await nonNativeUsd()).toBeCloseTo(0.00551 * 357, 6)

        setHidden(TSLAX, true)

        expect(await nonNativeUsd()).toBe(0)
    })

    it('Given a hidden token, when it receives a new transfer, then it stays hidden', async () => {
        setHidden(PVC, true)

        await addToAssetHolding({
            accountAddress: ETH_ADDRESS,
            assetId: PVC,
            scope: ETH_SCOPE,
            amount: new Decimal('1000000000000000000'),
        })

        renderList()
        await screen.findByTestId(`asset_row_${TSLAX}`)
        expect(screen.queryByTestId(`asset_row_${PVC}`)).toBeNull()
    })
})
