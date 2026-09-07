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

// Quantum-fee explainer on the interactive signing review surface. Reuses the
// canonical signing-review harness (see sign-review-transaction.test.tsx) to
// mount the real review UI for an external (WalletConnect) payment, then asserts
// that FeeDisplay surfaces the QuantumFeeExplainer only when the resolved signer
// is a Quantum account and the feature flag is on. The explainer's rendering on
// this surface is otherwise unprotected by any test.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'

import { act, renderHook } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'

import { createTestQueryClient } from '@test-utils/render'
import { server } from '@test-utils/msw-server'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    buildPaymentTransaction,
    buildTransactionSignRequest,
    renderSignReview,
    screen,
    waitFor,
    REVIEW_RECEIVER_ADDRESS,
    REVIEW_SIGNER_ADDRESS,
    seedAlgo25Signer,
} from '@test-utils/signing-review'
import {
    AccountTypes,
    useAccountsStore,
    type QuantumAccount,
    type WatchAccount,
} from '@perawallet/wallet-core-accounts'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import { QUANTUM_FEE_EXPLAINER_TEST_ID } from '@modules/transactions/components/QuantumFeeExplainer'
import { QUANTUM_TEST_ADDRESS } from './__fixtures__/quantum'
import {
    mockAlgodAccountInformation,
    mockAlgodTransactionParams,
} from '@perawallet/wallet-core-blockchain/test-handlers'

const QUANTUM_FLAG = 'enable_quantum_accounts'
const SLOW_TEST_TIMEOUT_MS = 30_000

/**
 * Seed the real algo25 signer (mints the key + registers the account exactly as
 * the harness does), then flip its account type to Quantum. `isQuantumAccount`
 * keys off `type === 'quantum'`, so the pipeline's resolved signer — and the
 * per-transaction lookup by sender — both resolve to a Quantum account.
 */
const seedQuantumSigner = async (): Promise<void> => {
    const account = await seedAlgo25Signer()
    const quantumAccount: QuantumAccount = {
        id: account.id,
        type: AccountTypes.quantum,
        address: REVIEW_SIGNER_ADDRESS,
        keyPairId: account.keyPairId ?? '',
        name: account.name,
    }
    useAccountsStore.getState().setAccounts([quantumAccount])
    useAccountsStore
        .getState()
        .setSelectedAccountAddress(quantumAccount.address)
}

/**
 * A Quantum account rekeyed away to the real algo25 signer: the algo25 key
 * authorizes it, so the network fee is the standard one and the quantum
 * explainer must not appear. The quantum account itself is a store entry only
 * — its own key is never used once it is rekeyed.
 */
const seedQuantumRekeyedToStandard = async (): Promise<void> => {
    const signer = await seedAlgo25Signer()
    const rekeyedQuantum: QuantumAccount = {
        id: 'rekeyed-quantum',
        type: AccountTypes.quantum,
        address: QUANTUM_TEST_ADDRESS,
        keyPairId: 'unused-once-rekeyed',
        name: 'Rekeyed Quantum',
        rekeyAddress: signer.address,
    }
    useAccountsStore.getState().setAccounts([signer, rekeyedQuantum])
    useAccountsStore
        .getState()
        .setSelectedAccountAddress(rekeyedQuantum.address)
}

/**
 * The mirror image: a watch-only account rekeyed to a Quantum account, which
 * signs it. The signature is Falcon, so the fee carries the premium and the
 * explainer must appear even though the sender itself is not Quantum.
 */
const seedStandardRekeyedToQuantum = async (): Promise<void> => {
    await seedQuantumSigner()
    const rekeyedWatch: WatchAccount = {
        id: 'rekeyed-watch',
        type: AccountTypes.watch,
        address: REVIEW_RECEIVER_ADDRESS,
        name: 'Rekeyed Watch',
        rekeyAddress: REVIEW_SIGNER_ADDRESS,
    }
    const store = useAccountsStore.getState()
    store.setAccounts([...store.accounts, rekeyedWatch])
    store.setSelectedAccountAddress(rekeyedWatch.address)
}

/**
 * `renderSignReview` enqueues into a persisted store that nothing drains when a
 * test ends, so the review a later test renders is the FIRST request still
 * pending — an earlier test's. Every assertion here would then be made against
 * the wrong signer, which is exactly how the rekey cases below can pass while
 * the bug they cover is present.
 */
const drainPendingSignRequests = (): void => {
    const client = createTestQueryClient()
    const { result, unmount } = renderHook(() => useSigningRequest(), {
        wrapper: ({ children }) => (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        ),
    })
    act(() => {
        for (const request of [...result.current.pendingSignRequests]) {
            result.current.removeSignRequest(request)
        }
    })
    unmount()
}

/**
 * Turn the quantum-accounts flag on via the real remote-config override. The
 * store persists, so its async rehydration can otherwise land after the value
 * is set and wipe it — await hydration first so the override sticks for the
 * render under test.
 */
const enableQuantumFlag = async (): Promise<void> => {
    await useRemoteConfigStore.persist.rehydrate()
    useRemoteConfigStore.getState().setConfigOverride(QUANTUM_FLAG, true)
}

describe('Flow: quantum-fee explainer on the signing review surface', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })
    afterEach(() => {
        server.resetHandlers()
        // Feature-flag override must not leak into other tests/files.
        useRemoteConfigStore.getState().resetState()
    })
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        drainPendingSignRequests()
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        // The harness builds mainnet transactions (mainnet genesis hash); the
        // signing analyzer rejects any transaction that targets a network other
        // than the active one. `config.defaultNetwork` is mainnet in CI, but a
        // local `.env` may set it to testnet — pin mainnet so the review UI
        // (and its FeeDisplay) renders deterministically in both.
        useNetworkStore.getState().setNetwork('mainnet')
        server.use(
            mockAlgodTransactionParams({ response: { fee: 1000 } }),
            mockAlgodAccountInformation({
                address: REVIEW_SIGNER_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
        )
    })

    it(
        'renders the quantum-fee explainer when the resolved signer is a Quantum account',
        async () => {
            // Flag is off by default in tests (__DEV__ === false); enable it.
            await enableQuantumFlag()
            await seedQuantumSigner()
            const { request } = buildTransactionSignRequest()

            renderSignReview(request)

            // The review sheet opened once the slide-to-confirm control mounts.
            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('signing-confirm-slide'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )

            expect(
                await screen.findByTestId(QUANTUM_FEE_EXPLAINER_TEST_ID),
            ).toBeTruthy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'does not render the quantum-fee explainer for a standard (algo25) signer',
        async () => {
            await enableQuantumFlag()
            await seedAlgo25Signer()
            const { request } = buildTransactionSignRequest()

            renderSignReview(request)

            // Wait for the review to settle (FeeDisplay is on screen) before
            // asserting the explainer's absence.
            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('signing-confirm-slide'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )

            expect(
                screen.queryByTestId(QUANTUM_FEE_EXPLAINER_TEST_ID),
            ).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    // a rekey applied mid-session moves the effective signer across
    // the quantum boundary. The fee follows the rekeyed-to signer, so the
    // explainer has to follow the same hop or it describes the wrong signer.
    it(
        'does not render the quantum-fee explainer when the Quantum sender is rekeyed to a standard account',
        async () => {
            await enableQuantumFlag()
            await seedQuantumRekeyedToStandard()
            server.use(
                mockAlgodAccountInformation({
                    address: QUANTUM_TEST_ADDRESS,
                    response: {
                        amount: 5_000_000,
                        'min-balance': 100_000,
                        'auth-addr': REVIEW_SIGNER_ADDRESS,
                    },
                }),
            )
            const { request } = buildTransactionSignRequest({
                txs: [
                    buildPaymentTransaction({ sender: QUANTUM_TEST_ADDRESS }),
                ],
            })

            renderSignReview(request)

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('signing-confirm-slide'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )

            expect(
                screen.queryByTestId(QUANTUM_FEE_EXPLAINER_TEST_ID),
            ).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'renders the quantum-fee explainer when a standard sender is rekeyed to a Quantum account',
        async () => {
            await enableQuantumFlag()
            await seedStandardRekeyedToQuantum()
            server.use(
                mockAlgodAccountInformation({
                    address: REVIEW_RECEIVER_ADDRESS,
                    response: {
                        amount: 5_000_000,
                        'min-balance': 100_000,
                        'auth-addr': REVIEW_SIGNER_ADDRESS,
                    },
                }),
            )
            const { request } = buildTransactionSignRequest({
                txs: [
                    buildPaymentTransaction({
                        sender: REVIEW_RECEIVER_ADDRESS,
                        receiver: REVIEW_SIGNER_ADDRESS,
                    }),
                ],
            })

            renderSignReview(request)

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('signing-confirm-slide'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )

            expect(
                await screen.findByTestId(QUANTUM_FEE_EXPLAINER_TEST_ID),
            ).toBeTruthy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
