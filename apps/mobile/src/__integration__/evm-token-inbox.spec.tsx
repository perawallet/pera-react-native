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

import { useEffect } from 'react'
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
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { useNavigation, useRoute } from '@react-navigation/native'
import { Decimal } from 'decimal.js'
import {
    getAccountPortfolioTotals,
    hiddenAssetIdsOf,
    insertAssetHolding,
    setSelectedAccountId,
    upsertAccountChainState,
    useAccountsStore,
    useHiddenTokensInvalidation,
    useHiddenTokensStore,
    useKeptTokensStore,
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
import {
    AssetTransferRequestsScreen,
    TokenRequestDetailScreen,
} from '@modules/transactions/routes'
import { ETH_ADDRESS, ETH_SCOPE } from './__fixtures__/multichainHoldings'

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

const LISTED = '0x8aD3c73F833d3F9A523aB01476625F269aEb7Cf0'
const AIRDROP = '0x514B0000000000000000000000000000000046ca'
const SPAM = '0x3333333333333333333333333333333333333333'

const ACCOUNT: WalletAccount = {
    id: 'eth-inbox',
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

// A token Pera verifies, a priced one nobody vetted that arrived unasked, and
// one Pera flags as spam: one whole unit of each.
const seed = async () => {
    const ether = nativeAssetFor('ethereum')
    await upsertAssets({
        items: [
            ether,
            token(LISTED, 'Listed Coin', 'verified'),
            token(AIRDROP, 'Airdrop Coin', 'unverified'),
            token(SPAM, 'Free Airdrop', 'suspicious'),
        ],
        scope: ETH_SCOPE,
    })
    await upsertAccountChainState({
        accountAddress: ETH_ADDRESS,
        scope: ETH_SCOPE,
        nativeBalance: new Decimal('1000000000000000000'),
        chainData: { family: 'evm', nonce: { latest: 0, pending: 0 } },
    })
    for (const assetId of [ether.assetId, LISTED, AIRDROP, SPAM]) {
        await insertAssetHolding({
            accountAddress: ETH_ADDRESS,
            assetId,
            scope: ETH_SCOPE,
            amount: new Decimal('1000000000000000000'),
        })
    }
    await upsertAssetPrices({
        prices: [
            { assetId: LISTED, usdPrice: new Decimal('10') },
            { assetId: AIRDROP, usdPrice: new Decimal('5') },
        ],
        scope: ETH_SCOPE,
    })
}

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

// The app shell keeps the invalidation mounted under every screen; a flat test
// stack may unmount the list while the detail is on top.
const RequestsHost = () => {
    useHiddenTokensInvalidation()
    return <AssetTransferRequestsScreen />
}

const DetailHost = () => {
    useHiddenTokensInvalidation()
    return <TokenRequestDetailScreen />
}

// The detail screen pushes onto the Messages stack; forward to the flat
// stack's own route the way the real nested navigator would.
const MessagesDispatcher = () => {
    const navigation = useNavigation() as unknown as {
        replace: (name: string, params?: object) => void
    }
    const route = useRoute() as {
        params?: { screen?: string; params?: object }
    }
    useEffect(() => {
        if (route.params?.screen) {
            navigation.replace(route.params.screen, route.params.params ?? {})
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return null
}

const openInbox = () =>
    renderWithNavigation(RequestsHost, 'AssetTransferRequests', {
        initialParams: { accountId: ACCOUNT.id },
        additionalScreens: [
            { name: 'Messages', component: MessagesDispatcher },
            { name: 'TokenRequestDetail', component: DetailHost },
        ],
    })

const openRequest = async (assetId: string) => {
    fireEvent.click(await screen.findByTestId(`asset_row_${assetId}`))
    await screen.findByTestId('token_request_detail_screen')
}

const nonNativeUsd = async () =>
    (
        await getAccountPortfolioTotals({
            accountAddress: ETH_ADDRESS,
            scope: ETH_SCOPE,
        })
    ).nonNativeUsdValue.toNumber()

describe('Flow: tokens an Ethereum account never asked for wait in its inbox', () => {
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
        useKeptTokensStore.getState().resetState()
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
        useHiddenTokensStore.getState().resetState()
        useKeptTokensStore.getState().resetState()
    })

    it('Given an unvetted and a flagged token, when the asset list opens, then only the verified one is listed, the inbox row counts the others, and the total leaves them out', async () => {
        renderWithNavigation(ListHost, 'AccountAssetListHost')

        expect(await screen.findByTestId(`asset_row_${LISTED}`)).toBeTruthy()
        expect(screen.queryByTestId(`asset_row_${AIRDROP}`)).toBeNull()
        expect(screen.queryByTestId(`asset_row_${SPAM}`)).toBeNull()
        expect(
            (await screen.findByTestId('token_inbox_row')).textContent,
        ).toContain('token_visibility.inbox_row_title')
        expect(await nonNativeUsd()).toBeCloseTo(10, 6)
    })

    it('Given the inbox, when the user accepts the unvetted token, then it leaves the inbox, the asset list shows it and the total counts it', async () => {
        openInbox()
        await openRequest(AIRDROP)
        expect(
            screen.getByText('asset_inbox.token_request.question'),
        ).toBeTruthy()
        expect(screen.queryByTestId('token_request_suspicious')).toBeNull()

        fireEvent.click(screen.getByTestId('token_request_accept'))

        await waitFor(() =>
            expect(screen.queryByTestId(`asset_row_${AIRDROP}`)).toBeNull(),
        )
        expect(screen.getByTestId(`asset_row_${SPAM}`)).toBeTruthy()
        cleanup()
        renderWithNavigation(ListHost, 'AccountAssetListHost')
        expect(await screen.findByTestId(`asset_row_${AIRDROP}`)).toBeTruthy()
        expect(await nonNativeUsd()).toBeCloseTo(15, 6)
    })

    it('Given the inbox, when the user rejects the flagged token, then it is hidden and never comes back to the inbox', async () => {
        openInbox()
        await openRequest(SPAM)
        expect(screen.getByTestId('token_request_suspicious')).toBeTruthy()

        fireEvent.click(screen.getByTestId('token_request_reject'))

        await waitFor(() =>
            expect(screen.queryByTestId(`asset_row_${SPAM}`)).toBeNull(),
        )
        expect(screen.getByTestId(`asset_row_${AIRDROP}`)).toBeTruthy()
        expect(
            hiddenAssetIdsOf(
                useHiddenTokensStore.getState().hiddenTokens,
                ETH_ADDRESS,
                ETH_SCOPE,
            ),
        ).toEqual([SPAM])
    })

    it('Given the inbox, when the user confirms Reject All, then every waiting token is hidden', async () => {
        openInbox()
        fireEvent.click(await screen.findByTestId('asset_inbox_reject_all'))
        fireEvent.click(
            await screen.findByTestId('asset_inbox_reject_all_confirm'),
        )

        await waitFor(() =>
            expect(
                hiddenAssetIdsOf(
                    useHiddenTokensStore.getState().hiddenTokens,
                    ETH_ADDRESS,
                    ETH_SCOPE,
                ),
            ).toEqual([AIRDROP, SPAM].sort()),
        )
        expect(
            await screen.findByText('asset_inbox.requests.empty_title'),
        ).toBeTruthy()
    })
})
