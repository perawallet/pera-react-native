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

// Phase 2 — ARC-60 (Sign-In With Algorand) signing review. Exercises the
// Arc60SigningScreen happy path (valid SIWA → sign → signature callback) and
// the verified-origin ↔ SIWA-domain mismatch warning (the M6 webview path).

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
    buildArc60SignRequest,
    fireEvent,
    renderSignReview,
    screen,
    waitFor,
    REVIEW_SIGNER_ADDRESS,
    seedAlgo25Signer,
    seedQuantumSigner,
} from '@test-utils/signing-review'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'

const SLOW_TEST_TIMEOUT_MS = 30_000

describe('Flow: ARC-60 (SIWA) signing review', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })
    afterEach(() => {
        server.resetHandlers()
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
        await seedAlgo25Signer()
    })

    it(
        'signs a valid SIWA request and delivers the signature, with no origin-mismatch warning',
        async () => {
            const { request, approve, reject } = buildArc60SignRequest({
                domain: 'arc60.io',
                verifiedOrigin: 'https://arc60.io/login',
            })

            const { confirm } = renderSignReview(request)

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('arc60-confirm-slide'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )
            // Origin matches the SIWA domain → no warning.
            expect(
                screen.queryByTestId('arc60-origin-mismatch-warning'),
            ).toBeNull()

            confirm('arc60-confirm-slide')

            await waitFor(
                () => {
                    expect(approve).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
            const delivered = approve.mock.calls[0][0]
            expect(delivered[0].signature).toBeInstanceOf(Uint8Array)
            expect(delivered[0].signer).toBe(REVIEW_SIGNER_ADDRESS)
            expect(reject).not.toHaveBeenCalled()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'shows the origin-mismatch warning when the verified origin differs from the SIWA domain',
        async () => {
            const { request, reject } = buildArc60SignRequest({
                domain: 'trusted-exchange.com',
                verifiedOrigin: 'https://evil.example/phish',
            })

            const view = renderSignReview(request)

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('arc60-origin-mismatch-warning'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )

            // Settle the request so the pipeline is clean for the next test.
            view.reject()
            await waitFor(
                () => {
                    expect(reject).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'blocks a quantum signer with a terminal notice instead of the confirm control',
        async () => {
            const quantum = await seedQuantumSigner()
            const { request, approve, reject } = buildArc60SignRequest({
                signer: quantum.address,
            })

            renderSignReview(request)

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('arc60-quantum-blocked'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )
            // The harness renders i18n keys verbatim, so assert on the key.
            expect(
                screen.getByText('quantum.data_signing_unsupported.title'),
            ).toBeTruthy()
            expect(screen.queryByTestId('arc60-confirm-slide')).toBeNull()

            fireEvent.click(screen.getByText('common.close.label'))

            await waitFor(
                () => {
                    expect(reject).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
            expect(approve).not.toHaveBeenCalled()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
