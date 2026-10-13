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
// canonical signing-review harness (see sign-review-transaction.spec.tsx) to
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
import { seedAuthority } from '@test-utils/algorandAccountsAdapter'
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
    drainPendingSignRequests,
    renderSignReview,
    screen,
    waitFor,
    REVIEW_RECEIVER_ADDRESS,
    REVIEW_SIGNER_ADDRESS,
    seedAlgo25Signer,
} from '@test-utils/signing-review'
import {
    useAccountChainStateStore,
    useAccountsStore,
    type LocalAccount,
    type WatchAccount,
} from '@perawallet/wallet-core-accounts'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { QUANTUM_FEE_EXPLAINER_TEST_ID } from '@modules/transactions/components/QuantumFeeExplainer'
import { QUANTUM_TEST_ADDRESS } from './__fixtures__/quantum'
import {
    mockAlgodAccountInformation,
    mockAlgodTransactionParams,
} from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { addressOf } from './__fixtures__/accounts'

/**
 * Seed the real algo25 signer, then re-register its address as a Quantum
 * account. The scheme premium follows a loaded key's seed, so the account
 * names a key the keystore doesn't hold and its quantum custody stands in, as
 * it does for any key not yet loaded. The review only renders; nothing signs.
 */
const seedQuantumSigner = async (): Promise<void> => {
    const account = await seedAlgo25Signer()
    const quantumAccount: LocalAccount = {
        id: account.id,
        custody: { kind: 'local', seed: 'quantum' },
        chains: {
            algorand: {
                address: REVIEW_SIGNER_ADDRESS,
                keyPairId: 'review-quantum-key',
            },
        },
        name: account.name,
    }
    useAccountsStore.getState().setAccounts([quantumAccount])
    useAccountsStore.getState().setSelectedAccountId(quantumAccount.id)
}

/**
 * A Quantum account rekeyed away to the real algo25 signer: the algo25 key
 * authorizes it, so the network fee is the standard one and the quantum
 * explainer must not appear. The quantum account itself is a store entry only
 * — its own key is never used once it is rekeyed.
 */
const seedQuantumRekeyedToStandard = async (): Promise<void> => {
    const signer = await seedAlgo25Signer()
    const rekeyedQuantum: LocalAccount = {
        id: 'rekeyed-quantum',
        custody: { kind: 'local', seed: 'quantum' },
        chains: {
            algorand: {
                address: QUANTUM_TEST_ADDRESS,
                keyPairId: 'unused-once-rekeyed',
            },
        },
        name: 'Rekeyed Quantum',
    }
    seedAuthority(addressOf(rekeyedQuantum), addressOf(signer))
    useAccountsStore.getState().setAccounts([signer, rekeyedQuantum])
    useAccountsStore.getState().setSelectedAccountId(rekeyedQuantum.id)
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
        custody: { kind: 'watch' },
        chains: { algorand: { address: REVIEW_RECEIVER_ADDRESS } },
        name: 'Rekeyed Watch',
    }
    seedAuthority(addressOf(rekeyedWatch), REVIEW_SIGNER_ADDRESS)
    const store = useAccountsStore.getState()
    store.setAccounts([...store.accounts, rekeyedWatch])
    store.setSelectedAccountId(rekeyedWatch.id)
}

describe('Flow: quantum-fee explainer on the signing review surface', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterEach(() => {
        // Feature-flag override must not leak into other tests/files.
        useRemoteConfigStore.getState().resetState()
        useAccountChainStateStore.getState().resetState()
    })
    afterAll(async () => {
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

    it('renders the quantum-fee explainer when the resolved signer is a Quantum account', async () => {
        // Flag is off by default in tests (__DEV__ === false); enable it.
        await seedQuantumSigner()
        const { request } = buildTransactionSignRequest()

        renderSignReview(request)

        // The review sheet opened once the slide-to-confirm control mounts.
        await waitFor(
            () => {
                expect(screen.getByTestId('signing-confirm-slide')).toBeTruthy()
            },
            { timeout: 10_000 },
        )

        expect(
            await screen.findByTestId(QUANTUM_FEE_EXPLAINER_TEST_ID),
        ).toBeTruthy()
    })

    it('does not render the quantum-fee explainer for a standard (algo25) signer', async () => {
        await seedAlgo25Signer()
        const { request } = buildTransactionSignRequest()

        renderSignReview(request)

        // Wait for the review to settle (FeeDisplay is on screen) before
        // asserting the explainer's absence.
        await waitFor(
            () => {
                expect(screen.getByTestId('signing-confirm-slide')).toBeTruthy()
            },
            { timeout: 10_000 },
        )

        expect(screen.queryByTestId(QUANTUM_FEE_EXPLAINER_TEST_ID)).toBeNull()
    })

    // a rekey applied mid-session moves the effective signer across
    // the quantum boundary. The fee follows the rekeyed-to signer, so the
    // explainer has to follow the same hop or it describes the wrong signer.
    it('does not render the quantum-fee explainer when the Quantum sender is rekeyed to a standard account', async () => {
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
            txs: [buildPaymentTransaction({ sender: QUANTUM_TEST_ADDRESS })],
        })

        renderSignReview(request)

        await waitFor(
            () => {
                expect(screen.getByTestId('signing-confirm-slide')).toBeTruthy()
            },
            { timeout: 10_000 },
        )

        expect(screen.queryByTestId(QUANTUM_FEE_EXPLAINER_TEST_ID)).toBeNull()
    })

    it('renders the quantum-fee explainer when a standard sender is rekeyed to a Quantum account', async () => {
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
                expect(screen.getByTestId('signing-confirm-slide')).toBeTruthy()
            },
            { timeout: 10_000 },
        )

        expect(
            await screen.findByTestId(QUANTUM_FEE_EXPLAINER_TEST_ID),
        ).toBeTruthy()
    })
})
