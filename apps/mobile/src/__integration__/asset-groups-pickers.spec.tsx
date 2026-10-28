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
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { View } from 'react-native'

import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { mockCrossChainAssetGroups } from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { useSendFundsStore } from '@modules/transactions'
import { AssetSelectionScreen } from '@modules/transactions/screens/send-funds/AssetSelectionScreen/AssetSelectionScreen'
import {
    ETH_USDC,
    seedHoldings,
    TWO_CHAIN_ACCOUNT,
    USDC_GROUP,
} from './__fixtures__/multichainHoldings'
import { USDC_TEST_ASSET } from './__fixtures__/assets'

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

const Stub = () => <View testID='next-step-stub' />

describe('Flow: One asset held on two chains, picked per network', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useRemoteConfigStore.getState().resetState()
        useSendFundsStore.getState().reset()
        server.use(
            mockCrossChainAssetGroups({
                groups: { [USDC_TEST_ASSET.assetId]: USDC_GROUP },
            }),
        )
        await seedHoldings()
        useAccountsStore.getState().setAccounts([TWO_CHAIN_ACCOUNT])
        useAccountsStore.getState().setSelectedAccountId(TWO_CHAIN_ACCOUNT.id)
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
    })

    it('Given USDC on Algorand and Ethereum, when the send picker is on Ethereum, then Ethereum USDC is a plain row and picking it starts the send on Ethereum', async () => {
        useSendFundsStore.getState().setChainId('ethereum')
        renderWithNavigation(AssetSelectionScreen, 'SelectAsset', {
            additionalScreens: [
                { name: 'InputAmount', component: Stub },
                { name: 'SelectDestination', component: Stub },
            ],
        })

        const ethUsdc = await screen.findByTestId(`asset-list-item-${ETH_USDC}`)
        // One network folds nothing, and the other network's USDC isn't offered.
        expect(screen.queryByTestId('asset_group_row_usdc')).toBeNull()
        expect(
            screen.queryByTestId(`asset-list-item-${USDC_TEST_ASSET.assetId}`),
        ).toBeNull()

        fireEvent.click(ethUsdc)

        await waitFor(() => {
            expect(screen.getByTestId('next-step-stub')).toBeTruthy()
        })
        expect(useSendFundsStore.getState().selectedAsset).toEqual({
            chainId: 'ethereum',
            assetId: ETH_USDC,
        })
    })
})
