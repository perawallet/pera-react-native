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
import { RekeyToLedgerIntroScreen } from '@modules/rekey/screens/rekey-to-ledger/RekeyToLedgerIntroScreen'
import { RekeyToLedgerSelectTargetScreen } from '@modules/rekey/screens/rekey-to-ledger/RekeyToLedgerSelectTargetScreen'
import { RekeyToLedgerConfirmScreen } from '@modules/rekey/screens/rekey-to-ledger/RekeyToLedgerConfirmScreen'
import { RekeyToLedgerSuccessScreen } from '@modules/rekey/screens/rekey-to-ledger/RekeyToLedgerSuccessScreen'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC_INDICES,
    HD_TEST_ADDRESS,
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
        id: 'rekey-ledger-source',
        type: AccountTypes.algo25,
        address: ALGO25_TEST_ADDRESS,
        keyPairId: key!.seedKey.id ?? '',
        name: 'Source',
    }
    const target: WalletAccount = {
        id: 'rekey-ledger-target',
        type: AccountTypes.hardware,
        address: HD_TEST_ADDRESS,
        name: 'Ledger target',
        hardwareDetails: {
            manufacturer: 'ledger',
            deviceId: 'test-device',
            deviceName: 'Ledger Nano X',
            accountIndex: 0,
            transportType: 'ble',
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
        name: 'RekeyToLedgerSelectTarget',
        component: RekeyToLedgerSelectTargetScreen,
    },
    {
        name: 'RekeyToLedgerConfirm',
        component: RekeyToLedgerConfirmScreen,
    },
    {
        name: 'RekeyToLedgerSuccess',
        component: RekeyToLedgerSuccessScreen,
    },
    { name: 'RekeyToLedger', component: NestedNavigateRedirect },
]

describe('Flow: Rekey to ledger account end-to-end', () => {
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
                address: HD_TEST_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
            mockAlgodStatus({ response: { 'last-round': 100 } }),
            mockAlgodSendRawTransaction(),
            mockIndexerSearchForAccounts(),
        )
    })

    it(
        'Given a funded source and an eligible Ledger target, when the user walks intro → select target → confirm, then a signed rekey payment is POSTed to algod and the success screen renders',
        async () => {
            await seedRekeyAccounts()

            const sendSpy = vi.fn(async () =>
                HttpResponse.json(
                    {
                        txId: 'REKEYLEDGERTESTTXID000000000000000000000000000000000000',
                    },
                    { status: 200 },
                ),
            )
            server.use(http.post('*/v2/transactions', sendSpy))

            renderWithNavigation(
                RekeyToLedgerIntroScreen,
                'RekeyToLedgerIntro',
                {
                    initialParams: { sourceAddress: ALGO25_TEST_ADDRESS },
                    additionalScreens: REKEY_SCREENS,
                },
            )

            await waitFor(() => {
                expect(
                    screen.getByTestId('rekey-to-ledger-intro-screen'),
                ).toBeTruthy()
            })
            fireEvent.click(screen.getByTestId('rekey-to-ledger-intro-start'))

            await waitFor(() => {
                expect(
                    screen.getByTestId('rekey-to-ledger-select-target-screen'),
                ).toBeTruthy()
            })
            await waitFor(() => {
                expect(
                    screen.getByTestId(`rekey-target-row-${HD_TEST_ADDRESS}`),
                ).toBeTruthy()
            })
            fireEvent.click(
                screen.getByTestId(`rekey-target-row-${HD_TEST_ADDRESS}`),
            )

            await waitFor(() => {
                expect(
                    screen.getByTestId('rekey-to-ledger-confirm-screen'),
                ).toBeTruthy()
            })
            const cta = screen.getByTestId(
                'rekey-to-ledger-confirm-cta',
            ) as HTMLButtonElement
            await waitFor(() => {
                expect(cta.disabled).toBe(false)
            })
            fireEvent.click(cta)

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('rekey-to-ledger-success-screen'),
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
                RekeyToLedgerConfirmScreen,
                'RekeyToLedgerConfirm',
                {
                    initialParams: {
                        sourceAddress: ALGO25_TEST_ADDRESS,
                        targetAddress: HD_TEST_ADDRESS,
                    },
                    additionalScreens: REKEY_SCREENS,
                },
            )

            await waitFor(() => {
                expect(
                    screen.getByTestId('rekey-to-ledger-confirm-screen'),
                ).toBeTruthy()
            })
            const cta = screen.getByTestId(
                'rekey-to-ledger-confirm-cta',
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
                screen.queryByTestId('rekey-to-ledger-success-screen'),
            ).toBeNull()
            expect(
                screen.getByTestId('rekey-to-ledger-confirm-screen'),
            ).toBeTruthy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
