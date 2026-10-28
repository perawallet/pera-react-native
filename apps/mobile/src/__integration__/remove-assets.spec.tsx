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
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Decimal } from 'decimal.js'
import { decodeSignedTransaction } from 'algosdk'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { seedAlgo25Signer } from '@test-utils/signing-review'
import { findEnabledByTestId } from '@test-utils/rnw'
import {
    resetTestDatabase,
    seedAlgoAsset,
    seedAlgorandAccountState,
    seedAssets,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    getAccountHoldings,
    insertAssetHolding,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    mockAlgodAccountInformation,
    mockAlgodStatus,
    mockAlgodTransactionParams,
} from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { RemoveAssetsScreen } from '@modules/accounts/screens/RemoveAssetsScreen'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import {
    NFT_TEST_ASSET,
    NFT_TEST_ASSET_ID,
    USDC_TEST_ASSET,
    USDC_TEST_ASSET_ID,
} from './__fixtures__/assets'

const MAINNET_SCOPE = {
    chainId: LEGACY_CHAIN_ID,
    networkId: 'mainnet',
} as const

// The opt-out closes the holding to the creator, so it must be a real address
// distinct from the sender (the fixture's placeholder doesn't encode).
const ASSET_CREATOR = HD_TEST_ADDRESS

const EMPTY_ASSET = {
    ...USDC_TEST_ASSET,
    creator: { address: ASSET_CREATOR },
}
const HELD_ASSET = { ...NFT_TEST_ASSET, creator: { address: ASSET_CREATOR } }

describe('Flow: Remove assets', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        await seedAssets([EMPTY_ASSET, HELD_ASSET], 'mainnet')

        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        await seedAlgo25Signer()

        await seedAlgorandAccountState({
            accountAddress: ALGO25_TEST_ADDRESS,
            scope: MAINNET_SCOPE,
            nativeBalance: new Decimal(5_000_000),
            totalAssetsOptedIn: 2,
            minBalance: new Decimal(300_000),
        })
        await insertAssetHolding({
            accountAddress: ALGO25_TEST_ADDRESS,
            assetId: USDC_TEST_ASSET_ID,
            scope: MAINNET_SCOPE,
            amount: new Decimal(0),
        })
        await insertAssetHolding({
            accountAddress: ALGO25_TEST_ADDRESS,
            assetId: NFT_TEST_ASSET_ID,
            scope: MAINNET_SCOPE,
            amount: new Decimal(1),
        })

        server.use(
            mockAlgodAccountInformation({
                address: ALGO25_TEST_ADDRESS,
                response: {
                    amount: 5_000_000,
                    'min-balance': 300_000,
                    assets: [
                        {
                            'asset-id': Number(USDC_TEST_ASSET_ID),
                            amount: 0,
                            'is-frozen': false,
                        },
                        {
                            'asset-id': Number(NFT_TEST_ASSET_ID),
                            amount: 1,
                            'is-frozen': false,
                        },
                    ],
                },
            }),
            mockAlgodTransactionParams({ response: { fee: 1000 } }),
            mockAlgodStatus({ response: { 'last-round': 100 } }),
        )
    })

    it('Given an account holding one zero-balance and one funded asset, when the screen loads, then only the zero-balance asset is offered and removal stays disabled until one is selected', async () => {
        renderWithNavigation(RemoveAssetsScreen, 'RemoveAssets')

        await waitFor(() => {
            expect(
                screen.getByTestId(`remove_asset_row_${USDC_TEST_ASSET_ID}`),
            ).toBeTruthy()
        })
        expect(
            screen.queryByTestId(`remove_asset_row_${NFT_TEST_ASSET_ID}`),
        ).toBeNull()
        expect(
            (
                screen.getByTestId(
                    'remove_assets_confirm_slide',
                ) as HTMLButtonElement
            ).disabled,
        ).toBe(true)
    })

    it('Given the zero-balance asset is selected, when the user confirms removal, then a zero-amount transfer closing to the creator is POSTed to algod and the holding is deleted', async () => {
        let submitted: Uint8Array | null = null
        const sendSpy = vi.fn(async ({ request }: { request: Request }) => {
            submitted = new Uint8Array(await request.arrayBuffer())
            return HttpResponse.json(
                {
                    txId: 'REMOVETXID00000000000000000000000000000000000000000000',
                },
                { status: 200 },
            )
        })
        server.use(http.post('*/v2/transactions', sendSpy))

        renderWithNavigation(RemoveAssetsScreen, 'RemoveAssets')

        await waitFor(() => {
            expect(
                screen.getByTestId(`remove_asset_row_${USDC_TEST_ASSET_ID}`),
            ).toBeTruthy()
        })
        fireEvent.click(
            screen.getByTestId(`remove_asset_row_${USDC_TEST_ASSET_ID}`),
        )
        fireEvent.click(
            await findEnabledByTestId('remove_assets_confirm_slide'),
        )

        await waitFor(() => expect(sendSpy).toHaveBeenCalledTimes(1), {
            timeout: 10_000,
        })
        const { txn } = decodeSignedTransaction(submitted!)
        expect(txn.sender.toString()).toBe(ALGO25_TEST_ADDRESS)
        expect(txn.assetTransfer?.assetIndex).toBe(BigInt(USDC_TEST_ASSET_ID))
        expect(txn.assetTransfer?.amount).toBe(0n)
        expect(txn.assetTransfer?.closeRemainderTo?.toString()).toBe(
            ASSET_CREATOR,
        )

        await waitFor(async () => {
            const holdings = await getAccountHoldings({
                accountAddress: ALGO25_TEST_ADDRESS,
                scope: MAINNET_SCOPE,
            })
            expect(holdings.map(h => h.assetId)).not.toContain(
                USDC_TEST_ASSET_ID,
            )
            expect(holdings.map(h => h.assetId)).toContain(NFT_TEST_ASSET_ID)
        })
    })
})
