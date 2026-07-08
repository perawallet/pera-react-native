/*
 Copyright 2022-2025 Pera Wallet, LDA
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

import { server } from '@test-utils/msw-server'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    buildTransactionSignRequest,
    renderSignReview,
    screen,
    waitFor,
    REVIEW_SIGNER_ADDRESS,
    seedAlgo25Signer,
} from '@test-utils/signing-review'
import {
    AccountTypes,
    useAccountsStore,
    type QuantumAccount,
} from '@perawallet/wallet-core-accounts'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { QUANTUM_FEE_EXPLAINER_TEST_ID } from '@modules/transactions/components/QuantumFeeExplainer'
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
})
