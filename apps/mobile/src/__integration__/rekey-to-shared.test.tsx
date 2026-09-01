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
import { Decimal } from 'decimal.js'
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Notifier } from 'react-native-notifier'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { NestedNavigateRedirect } from '@test-utils/nestedNavigateRedirect'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    AccountTypes,
    upsertAccountBalance,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS, type Algo25KeyResult } from '@perawallet/wallet-core-kms'
import {
    mockAlgodAccountInformation,
    mockAlgodSendRawTransaction,
    mockAlgodStatus,
    mockAlgodTransactionParams,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-blockchain/test-handlers'
import { RekeyToSharedIntroScreen } from '@modules/rekey/screens/rekey-to-shared/RekeyToSharedIntroScreen'
import { RekeyToSharedSelectTargetScreen } from '@modules/rekey/screens/rekey-to-shared/RekeyToSharedSelectTargetScreen'
import { RekeyToSharedConfirmScreen } from '@modules/rekey/screens/rekey-to-shared/RekeyToSharedConfirmScreen'
import { RekeyToSharedSuccessScreen } from '@modules/rekey/screens/rekey-to-shared/RekeyToSharedSuccessScreen'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC_INDICES,
    MULTISIG_REKEY_INTEGRATION_ADDRESS,
} from './__fixtures__/onboarding'

const SLOW_TEST_TIMEOUT_MS = 30_000

const seedRekeyAccounts = async (): Promise<{
    source: WalletAccount
    target: WalletAccount
}> => {
    const { result: kms } = renderHook(() => useKMS())
    let key: Algo25KeyResult | null = null
    await waitFor(async () => {
        key = await kms.current.createAlgo25Key({
            mnemonicIndices: ALGO25_TEST_MNEMONIC_INDICES,
        })
        expect(key).not.toBeNull()
    })
    const source: WalletAccount = {
        id: 'rekey-shared-source',
        type: AccountTypes.algo25,
        address: ALGO25_TEST_ADDRESS,
        keyPairId: key!.seedKey.id ?? '',
        name: 'Source',
    }
    const target: WalletAccount = {
        id: 'rekey-shared-target',
        type: AccountTypes.multisig,
        address: MULTISIG_REKEY_INTEGRATION_ADDRESS,
        name: 'Shared target',
        multisigDetails: {
            threshold: 1,
            addresses: [ALGO25_TEST_ADDRESS],
            version: 1,
        },
    }
    useAccountsStore.getState().setAccounts([source, target])
    useAccountsStore.getState().setSelectedAccountAddress(source.address)

    await upsertAccountBalance({
        accountAddress: source.address,
        network: 'mainnet',
        algoBalance: new Decimal(5_000_000),
        totalAssetsOptedIn: 0,
        totalCreatedAssets: 0,
        totalAppsOptedIn: 0,
        minBalance: new Decimal(100_000),
        status: 'Offline',
        authAddress: null,
    })

    return { source, target }
}

const REKEY_SCREENS = [
    {
        name: 'RekeyToSharedSelectTarget',
        component: RekeyToSharedSelectTargetScreen,
    },
    {
        name: 'RekeyToSharedConfirm',
        component: RekeyToSharedConfirmScreen,
    },
    {
        name: 'RekeyToSharedSuccess',
        component: RekeyToSharedSuccessScreen,
    },
    { name: 'RekeyToShared', component: NestedNavigateRedirect },
]

describe('Flow: Rekey to shared account end-to-end', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })
    afterEach(() => server.resetHandlers())
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        vi.mocked(Notifier.showNotification).mockClear()

        server.use(
            mockAlgodTransactionParams({ response: { fee: 1000 } }),
            mockAlgodAccountInformation({
                address: ALGO25_TEST_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
            mockAlgodAccountInformation({
                address: MULTISIG_REKEY_INTEGRATION_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
            mockAlgodStatus({ response: { 'last-round': 100 } }),
            mockAlgodSendRawTransaction(),
            mockIndexerSearchForAccounts(),
        )
    })

    it(
        'Given a funded source and an eligible shared target, when the user walks intro → select target → confirm, then a signed rekey payment is POSTed to algod and the success screen renders',
        async () => {
            await seedRekeyAccounts()

            const sendSpy = vi.fn(async () =>
                HttpResponse.json(
                    {
                        txId: 'REKEYSHRDTOSTESTTXID000000000000000000000000000000000000',
                    },
                    { status: 200 },
                ),
            )
            server.use(http.post('*/v2/transactions', sendSpy))

            renderWithNavigation(
                RekeyToSharedIntroScreen,
                'RekeyToSharedIntro',
                {
                    initialParams: { sourceAddress: ALGO25_TEST_ADDRESS },
                    additionalScreens: REKEY_SCREENS,
                },
            )

            await waitFor(() => {
                expect(
                    screen.getByTestId('rekey-to-shared-intro-screen'),
                ).toBeTruthy()
            })
            fireEvent.click(screen.getByTestId('rekey-to-shared-intro-start'))

            await waitFor(() => {
                expect(
                    screen.getByTestId('rekey-to-shared-select-target-screen'),
                ).toBeTruthy()
            })
            await waitFor(() => {
                expect(
                    screen.getByTestId(
                        `rekey-target-row-${MULTISIG_REKEY_INTEGRATION_ADDRESS}`,
                    ),
                ).toBeTruthy()
            })
            fireEvent.click(
                screen.getByTestId(
                    `rekey-target-row-${MULTISIG_REKEY_INTEGRATION_ADDRESS}`,
                ),
            )

            await waitFor(() => {
                expect(
                    screen.getByTestId('rekey-to-shared-confirm-screen'),
                ).toBeTruthy()
            })
            const cta = screen.getByTestId(
                'rekey-to-shared-confirm-cta',
            ) as HTMLButtonElement
            await waitFor(() => {
                expect(cta.disabled).toBe(false)
            })
            fireEvent.click(cta)

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('rekey-to-shared-success-screen'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )

            expect(sendSpy).toHaveBeenCalled()
            const calls = sendSpy.mock.calls as unknown as Array<
                [{ request: Request }]
            >
            const body = await calls[0][0].request.arrayBuffer()
            expect(body.byteLength).toBeGreaterThan(50)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given algod rejects the submission, when the user confirms, then a rekey error toast surfaces and the success screen is NOT shown',
        async () => {
            await seedRekeyAccounts()

            server.use(
                http.post('*/v2/transactions', () =>
                    HttpResponse.json(
                        { message: 'TransactionPool.Remember: rejected' },
                        { status: 500 },
                    ),
                ),
            )

            renderWithNavigation(
                RekeyToSharedConfirmScreen,
                'RekeyToSharedConfirm',
                {
                    initialParams: {
                        sourceAddress: ALGO25_TEST_ADDRESS,
                        targetAddress: MULTISIG_REKEY_INTEGRATION_ADDRESS,
                    },
                    additionalScreens: REKEY_SCREENS,
                },
            )

            await waitFor(() => {
                expect(
                    screen.getByTestId('rekey-to-shared-confirm-screen'),
                ).toBeTruthy()
            })
            const cta = screen.getByTestId(
                'rekey-to-shared-confirm-cta',
            ) as HTMLButtonElement
            await waitFor(() => {
                expect(cta.disabled).toBe(false)
            })
            fireEvent.click(cta)

            await waitFor(
                () => {
                    expect(Notifier.showNotification).toHaveBeenCalled()
                },
                { timeout: 25_000 },
            )

            expect(
                screen.queryByTestId('rekey-to-shared-success-screen'),
            ).toBeNull()
            expect(
                screen.getByTestId('rekey-to-shared-confirm-screen'),
            ).toBeTruthy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
