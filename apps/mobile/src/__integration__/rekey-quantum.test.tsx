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

// Quantum accounts in the rekey-to-standard flow: rekey-IN lists a quantum
// account as a selectable target (the migration path onto post-quantum keys),
// and rekey-OUT opens the QuantumDowngradeWarningSheet before any signing.
//
// Rekey-out CAN be signed, so the last test drives
// past the sheet with a real Falcon key and a rejecting algod: no algod in
// production accepts `pqsig`, which makes a failed submission the normal
// rekey-out outcome there, and the CTA must recover from it.

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
import { Notifier } from 'react-native-notifier'

import { http, HttpResponse, server } from '@test-utils/msw-server'
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
import {
    useKMS,
    type Algo25KeyResult,
    type QuantumKeyResult,
} from '@perawallet/wallet-core-kms'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import {
    mockAlgodAccountInformation,
    mockAlgodSendRawTransaction,
    mockAlgodStatus,
    mockAlgodTransactionParams,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-blockchain/test-handlers'
import { RekeyToStandardSelectTargetScreen } from '@modules/rekey/screens/rekey-to-standard/RekeyToStandardSelectTargetScreen'
import { RekeyToStandardConfirmScreen } from '@modules/rekey/screens/rekey-to-standard/RekeyToStandardConfirmScreen'
import { RekeyToStandardSuccessScreen } from '@modules/rekey/screens/rekey-to-standard/RekeyToStandardSuccessScreen'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC_INDICES,
    HD_TEST_ADDRESS,
} from './__fixtures__/onboarding'
import {
    QUANTUM_TEST_ADDRESS,
    QUANTUM_TEST_MNEMONIC_INDICES,
} from './__fixtures__/quantum'

const SLOW_TEST_TIMEOUT_MS = 30_000

const QUANTUM_FLAG_KEY = 'enable_quantum_accounts'

const enableQuantumFlag = async (): Promise<void> => {
    await useRemoteConfigStore.persist.rehydrate()
    useRemoteConfigStore.getState().setConfigOverride(QUANTUM_FLAG_KEY, true)
}

const disableQuantumFlag = async (): Promise<void> => {
    await useRemoteConfigStore.persist.rehydrate()
    useRemoteConfigStore.getState().setConfigOverride(QUANTUM_FLAG_KEY, false)
}

// The production rekey screens navigate via `navigate('RekeyToStandard', {
// screen, params })`. The flat test navigator can't resolve nested routes, so
// register each screen as a sibling plus a `RekeyToStandard` redirect shim
// (mirrors `rekey-to-standard.test.tsx`).
const REKEY_SCREENS = [
    {
        name: 'RekeyToStandardConfirm',
        component: RekeyToStandardConfirmScreen,
    },
    {
        name: 'RekeyToStandardSuccess',
        component: RekeyToStandardSuccessScreen,
    },
    { name: 'RekeyToStandard', component: NestedNavigateRedirect },
]

// Rekey-IN: a real algo25 source (its own signing keys matter for
// `isEligibleRekeyTarget`'s "not the target" checks elsewhere), and a quantum
// account as the candidate TARGET. A fake `keyPairId` is enough for the
// target — `isEligibleRekeyTarget` only checks the field is non-empty, and
// this test never signs with it.
const seedRekeyInAccounts = async (): Promise<{
    source: WalletAccount
    quantumTarget: WalletAccount
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
        id: 'rekey-in-source',
        type: AccountTypes.algo25,
        address: ALGO25_TEST_ADDRESS,
        keyPairId: key!.seedKey.id ?? '',
        name: 'Source',
    }
    const quantumTarget: WalletAccount = {
        id: 'rekey-in-quantum-target',
        type: AccountTypes.quantum,
        address: QUANTUM_TEST_ADDRESS,
        keyPairId: 'rekey-in-quantum-target-key',
        name: 'Quantum target',
    }
    useAccountsStore.getState().setAccounts([source, quantumTarget])
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

    return { source, quantumTarget }
}

// Rekey-OUT: a quantum SOURCE and a standard (algo25) TARGET. Neither test in
// this suite drives past the downgrade warning sheet, so signing never runs —
// fake `keyPairId`s are enough for both accounts (mirrors the target-side
// pattern in `rekey-to-standard.test.tsx`).
const seedRekeyOutAccounts = async (): Promise<{
    quantumSource: WalletAccount
    target: WalletAccount
}> => {
    const quantumSource: WalletAccount = {
        id: 'rekey-out-quantum-source',
        type: AccountTypes.quantum,
        address: QUANTUM_TEST_ADDRESS,
        keyPairId: 'rekey-out-quantum-source-key',
        name: 'Quantum source',
    }
    const target: WalletAccount = {
        id: 'rekey-out-target',
        type: AccountTypes.algo25,
        address: HD_TEST_ADDRESS,
        keyPairId: 'rekey-out-target-key',
        name: 'Target',
    }
    useAccountsStore.getState().setAccounts([quantumSource, target])
    useAccountsStore.getState().setSelectedAccountAddress(quantumSource.address)

    await upsertAccountBalance({
        accountAddress: quantumSource.address,
        network: 'mainnet',
        algoBalance: new Decimal(5_000_000),
        totalAssetsOptedIn: 0,
        totalCreatedAssets: 0,
        totalAppsOptedIn: 0,
        minBalance: new Decimal(100_000),
        status: 'Offline',
        authAddress: null,
    })

    return { quantumSource, target }
}

// Same rekey-OUT pair, but with a REAL Falcon key minted in the in-memory
// keystore so the flow can be driven all the way through signing and submit.
const seedSignableRekeyOutAccounts = async (): Promise<{
    quantumSource: WalletAccount
    target: WalletAccount
}> => {
    const { result: kms } = renderHook(() => useKMS())
    let keyResult: QuantumKeyResult | null = null
    await waitFor(async () => {
        keyResult = await kms.current.createQuantumKey({
            mnemonicIndices: QUANTUM_TEST_MNEMONIC_INDICES,
        })
        expect(keyResult).not.toBeNull()
    })

    const { quantumSource, target } = await seedRekeyOutAccounts()
    const signableSource: WalletAccount = {
        ...quantumSource,
        keyPairId: keyResult!.signKeyId,
    }
    useAccountsStore.getState().setAccounts([signableSource, target])
    useAccountsStore
        .getState()
        .setSelectedAccountAddress(signableSource.address)

    return { quantumSource: signableSource, target }
}

describe('rekey quantum account', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })
    afterEach(() => {
        server.resetHandlers()
        useRemoteConfigStore.getState().resetState()
    })
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useRemoteConfigStore.getState().resetState()
        vi.mocked(Notifier.showNotification).mockClear()

        server.use(
            mockAlgodTransactionParams({ response: { fee: 1000 } }),
            mockAlgodAccountInformation({
                address: ALGO25_TEST_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
            mockAlgodAccountInformation({
                address: QUANTUM_TEST_ADDRESS,
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
        'Given the quantum flag is on and a quantum account is held locally, when the user opens rekey-to-standard select-target, then the quantum account is listed as a selectable target',
        async () => {
            await enableQuantumFlag()
            const { source, quantumTarget } = await seedRekeyInAccounts()

            renderWithNavigation(
                RekeyToStandardSelectTargetScreen,
                'RekeyToStandardSelectTarget',
                {
                    initialParams: { sourceAddress: source.address },
                    additionalScreens: REKEY_SCREENS,
                },
            )

            await waitFor(() => {
                expect(
                    screen.getByTestId(
                        'rekey-to-standard-select-target-screen',
                    ),
                ).toBeTruthy()
            })
            await waitFor(() => {
                expect(
                    screen.getByTestId(
                        `rekey-target-row-${quantumTarget.address}`,
                    ),
                ).toBeTruthy()
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the quantum flag is off, when the user opens rekey-to-standard select-target, then the quantum account is not listed as a target',
        async () => {
            await disableQuantumFlag()
            const { source, quantumTarget } = await seedRekeyInAccounts()

            renderWithNavigation(
                RekeyToStandardSelectTargetScreen,
                'RekeyToStandardSelectTarget',
                {
                    initialParams: { sourceAddress: source.address },
                    additionalScreens: REKEY_SCREENS,
                },
            )

            await waitFor(() => {
                expect(
                    screen.getByTestId(
                        'rekey-to-standard-select-target-screen',
                    ),
                ).toBeTruthy()
            })
            expect(
                screen.queryByTestId(
                    `rekey-target-row-${quantumTarget.address}`,
                ),
            ).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a quantum source and a standard target, when the user confirms the rekey, then the quantum-downgrade warning sheet appears before any signing occurs',
        async () => {
            await enableQuantumFlag()
            const { quantumSource, target } = await seedRekeyOutAccounts()

            // Registered before driving to confirm so we can assert the
            // downgrade warning sheet blocks the flow before any broadcast
            // is attempted.
            const submitSpy = vi.fn(() =>
                HttpResponse.json({ txId: 'REKEY_MOCK' }, { status: 200 }),
            )
            server.use(http.post('*/v2/transactions', submitSpy))

            renderWithNavigation(
                RekeyToStandardConfirmScreen,
                'RekeyToStandardConfirm',
                {
                    initialParams: {
                        sourceAddress: quantumSource.address,
                        targetAddress: target.address,
                    },
                    additionalScreens: REKEY_SCREENS,
                },
            )

            await waitFor(() => {
                expect(
                    screen.getByTestId('rekey-to-standard-confirm-screen'),
                ).toBeTruthy()
            })
            const cta = screen.getByTestId(
                'rekey-to-standard-confirm-cta',
            ) as HTMLButtonElement
            await waitFor(() => {
                expect(cta.disabled).toBe(false)
            })
            fireEvent.click(cta)

            await waitFor(() => {
                expect(
                    screen.getByTestId('quantum-downgrade-warning-sheet'),
                ).toBeTruthy()
            })
            expect(submitSpy).not.toHaveBeenCalled()

            // The suite stops here on purpose (see the file-level comment):
            // this test's job is the warning sheet gate, not full
            // sign/submit coverage — confirming past it is out of scope
            // here even though signing quantum accounts now works.
            expect(
                screen.queryByTestId('rekey-to-standard-success-screen'),
            ).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the downgrade is confirmed and algod rejects the submission, when the error toast surfaces, then the confirm CTA leaves its loading state so the user can retry',
        async () => {
            await enableQuantumFlag()
            const { quantumSource, target } =
                await seedSignableRekeyOutAccounts()

            server.use(
                http.post('*/v2/transactions', () =>
                    HttpResponse.json(
                        { message: 'TransactionPool.Remember: rejected' },
                        { status: 400 },
                    ),
                ),
            )

            renderWithNavigation(
                RekeyToStandardConfirmScreen,
                'RekeyToStandardConfirm',
                {
                    initialParams: {
                        sourceAddress: quantumSource.address,
                        targetAddress: target.address,
                    },
                    additionalScreens: REKEY_SCREENS,
                },
            )

            const cta = await screen.findByTestId(
                'rekey-to-standard-confirm-cta',
            )
            await waitFor(() => {
                expect((cta as HTMLButtonElement).disabled).toBe(false)
            })
            fireEvent.click(cta)

            await waitFor(() => {
                expect(
                    screen.getByTestId('quantum-downgrade-warning-sheet'),
                ).toBeTruthy()
            })
            fireEvent.click(
                screen.getByText('rekey.quantum_downgrade_warning.confirm'),
            )

            await waitFor(
                () => {
                    expect(Notifier.showNotification).toHaveBeenCalled()
                },
                { timeout: 25_000 },
            )

            await waitFor(() => {
                expect(screen.queryByTestId('activity-indicator')).toBeNull()
            })
            expect((cta as HTMLButtonElement).disabled).toBe(false)

            vi.mocked(Notifier.showNotification).mockClear()
            fireEvent.click(cta)
            await waitFor(() => {
                expect(
                    screen.getByTestId('quantum-downgrade-warning-sheet'),
                ).toBeTruthy()
            })
            fireEvent.click(
                screen.getByText('rekey.quantum_downgrade_warning.confirm'),
            )
            await waitFor(
                () => {
                    expect(Notifier.showNotification).toHaveBeenCalled()
                },
                { timeout: 25_000 },
            )
            await waitFor(() => {
                expect(screen.queryByTestId('activity-indicator')).toBeNull()
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
