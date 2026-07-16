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

// Integration coverage for the undo-rekey flow:
//
//   Confirm ─► (warning sheet) ─► (sign + submit) ─► Success
//
// The source account is currently rekeyed away to a held auth account, so
// the signing pipeline resolves the auth account through the rekey chain and
// signs the rekey-to-self payment with the auth account's KMS key. The
// Confirm CTA first opens a confirmation bottom sheet; the flow only proceeds
// once the user accepts it.

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
    fireEvent,
    renderHook,
    screen,
    waitFor,
    within,
} from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Decimal } from 'decimal.js'

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
import { UndoRekeyConfirmScreen } from '@modules/rekey/screens/undo-rekey/UndoRekeyConfirmScreen'
import { UndoRekeySuccessScreen } from '@modules/rekey/screens/undo-rekey/UndoRekeySuccessScreen'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC,
    REKEY_TARGET_ADDRESS,
} from './__fixtures__/onboarding'

const SLOW_TEST_TIMEOUT_MS = 30_000

// The source is a rekeyed account; the held auth account does the signing.
// integration tests don't load i18n, so `t()` returns the raw key — the
// warning sheet's confirm/cancel buttons render their i18n keys verbatim.
const WARNING_CONFIRM_KEY = 'rekey.undo.warning.confirm'
const WARNING_CANCEL_KEY = 'rekey.undo.warning.cancel'

// Mint the auth account's real KMS key and register both accounts: the
// rekeyed source (no signing key of its own) and the auth account its
// `rekeyAddress` points at. The signing pipeline walks that chain.
const seedRekeyedSource = async (): Promise<{
    source: WalletAccount
    authAccount: WalletAccount
}> => {
    const { result: kms } = renderHook(() => useKMS())
    let key: Algo25KeyResult | null = null
    await waitFor(async () => {
        key = await kms.current.createAlgo25Key({
            mnemonic: ALGO25_TEST_MNEMONIC,
        })
        expect(key).not.toBeNull()
    })
    const authAccount: WalletAccount = {
        id: 'undo-auth',
        type: AccountTypes.algo25,
        address: ALGO25_TEST_ADDRESS,
        keyPairId: key!.seedKey.id ?? '',
        name: 'Auth',
    }
    const source: WalletAccount = {
        id: 'undo-source',
        type: AccountTypes.algo25,
        address: REKEY_TARGET_ADDRESS,
        keyPairId: '',
        name: 'Rekeyed source',
        rekeyAddress: ALGO25_TEST_ADDRESS,
    }
    useAccountsStore.getState().setAccounts([source, authAccount])
    useAccountsStore.getState().setSelectedAccountAddress(source.address)
    // The source pays the undo fee — the confirm screen's fee preflight
    // reads this balance row and disables the CTA without it.
    await upsertAccountBalance({
        accountAddress: source.address,
        network: 'mainnet',
        algoBalance: new Decimal(5),
        totalAssetsOptedIn: 0,
        totalCreatedAssets: 0,
        totalAppsOptedIn: 0,
        minBalance: new Decimal(0.1),
        status: 'Offline',
        authAddress: authAccount.address,
    })
    return { source, authAccount }
}

// `navigate('UndoRekey', { screen, params })` is bridged onto the flat test
// navigator by registering each screen as a sibling plus a redirect shim.
const UNDO_REKEY_SCREENS = [
    { name: 'UndoRekeySuccess', component: UndoRekeySuccessScreen },
    { name: 'UndoRekey', component: NestedNavigateRedirect },
]

const renderConfirm = () =>
    renderWithNavigation(UndoRekeyConfirmScreen, 'UndoRekeyConfirm', {
        initialParams: { sourceAddress: REKEY_TARGET_ADDRESS },
        additionalScreens: UNDO_REKEY_SCREENS,
    })

describe('Flow: Undo rekey end-to-end', () => {
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

        server.use(
            mockAlgodTransactionParams({ response: { fee: 1000 } }),
            mockAlgodAccountInformation({
                address: REKEY_TARGET_ADDRESS,
                response: {
                    amount: 5_000_000,
                    'min-balance': 100_000,
                    'auth-addr': ALGO25_TEST_ADDRESS,
                },
            }),
            mockAlgodAccountInformation({
                address: ALGO25_TEST_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
            mockAlgodStatus({ response: { 'last-round': 100 } }),
            mockAlgodSendRawTransaction(),
            mockIndexerSearchForAccounts(),
        )
    })

    it(
        'Given a rekeyed account, when the user confirms the undo and accepts the warning sheet, then a signed rekey payment is POSTed to algod and the success screen renders',
        async () => {
            await seedRekeyedSource()

            const sendSpy = vi.fn(async () =>
                HttpResponse.json(
                    {
                        txId: 'UNDOREKEYTESTTXID000000000000000000000000000000000000',
                    },
                    { status: 200 },
                ),
            )
            server.use(http.post('*/v2/transactions', sendSpy))

            renderConfirm()

            await waitFor(() => {
                expect(
                    screen.getByTestId('undo-rekey-confirm-screen'),
                ).toBeTruthy()
            })
            const cta = screen.getByTestId(
                'undo-rekey-confirm-cta',
            ) as HTMLButtonElement
            await waitFor(() => {
                expect(cta.disabled).toBe(false)
            })
            fireEvent.click(cta)

            const sheet = await waitFor(() =>
                screen.getByTestId('undo-rekey-warning-sheet'),
            )
            fireEvent.click(within(sheet).getByText(WARNING_CONFIRM_KEY))

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('undo-rekey-success-screen'),
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
        'Given the warning sheet is open, when the user cancels it, then no transaction is submitted and the confirm screen stays mounted',
        async () => {
            await seedRekeyedSource()

            const sendSpy = vi.fn(async () =>
                HttpResponse.json({ txId: 'SHOULDNOTSUBMIT' }, { status: 200 }),
            )
            server.use(http.post('*/v2/transactions', sendSpy))

            renderConfirm()

            await waitFor(() => {
                expect(
                    screen.getByTestId('undo-rekey-confirm-screen'),
                ).toBeTruthy()
            })
            const cta = screen.getByTestId(
                'undo-rekey-confirm-cta',
            ) as HTMLButtonElement
            await waitFor(() => {
                expect(cta.disabled).toBe(false)
            })
            fireEvent.click(cta)

            const sheet = await waitFor(() =>
                screen.getByTestId('undo-rekey-warning-sheet'),
            )
            fireEvent.click(within(sheet).getByText(WARNING_CANCEL_KEY))

            await waitFor(() => {
                expect(
                    screen.queryByTestId('undo-rekey-warning-sheet'),
                ).toBeNull()
            })
            expect(sendSpy).not.toHaveBeenCalled()
            expect(screen.queryByTestId('undo-rekey-success-screen')).toBeNull()
            expect(screen.getByTestId('undo-rekey-confirm-screen')).toBeTruthy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
