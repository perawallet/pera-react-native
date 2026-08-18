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

// Phase 2 — arbitrary-data (`algo_signData`) signing end-to-end through the
// review UI: ArbitraryDataSigningScreen → slide-to-confirm → MX-prefixed
// signature delivered to the callback transport.

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
    buildArbitraryDataSignRequest,
    fireEvent,
    renderSignReview,
    screen,
    waitFor,
    seedAlgo25Signer,
    seedQuantumSigner,
} from '@test-utils/signing-review'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'

const SLOW_TEST_TIMEOUT_MS = 30_000

describe('Flow: arbitrary-data (algo_signData) signing review', () => {
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
        'signs a single arbitrary-data message and delivers the signature to the callback',
        async () => {
            const { request, approve, reject } = buildArbitraryDataSignRequest()

            const { confirm } = renderSignReview(request)

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('arbitrary-data-confirm-slide'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )

            // The decoded payload ('aGVsbG8=' → "hello") is the actual signed
            // content and must be surfaced — not just the untrusted message.
            expect(screen.getByText('hello')).toBeTruthy()

            confirm('arbitrary-data-confirm-slide')

            await waitFor(
                () => {
                    expect(approve).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
            // A signature was produced and handed back to the dApp.
            const delivered = approve.mock.calls[0][0]
            expect(Array.isArray(delivered)).toBe(true)
            expect(delivered[0].signature).toBeInstanceOf(Uint8Array)
            expect(reject).not.toHaveBeenCalled()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'renders a binary payload as a hex dump with the unreadable-data warning',
        async () => {
            // 0x88 0x81 0xA1 0xFF is not valid UTF-8, so showing it as text
            // would collapse it to replacement characters.
            const { request, reject } = buildArbitraryDataSignRequest({
                messages: [{ data: 'iIGh/w==' }],
            })

            const view = renderSignReview(request)

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('arbitrary-data-confirm-slide'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )

            expect(screen.getByText('8881a1ff')).toBeTruthy()
            // The harness renders i18n keys verbatim, so assert on the key.
            expect(
                screen.getByText(
                    'signing.arbitrary_data_view.binary_warning_title',
                ),
            ).toBeTruthy()

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
        'rejects an arbitrary-data request when the user cancels',
        async () => {
            const { request, approve, reject } = buildArbitraryDataSignRequest({
                messages: [{ message: 'Authenticate to dApp' }],
            })

            const view = renderSignReview(request)

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('arbitrary-data-confirm-slide'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )

            view.reject()

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

    it(
        'blocks a quantum signer with a terminal notice instead of the confirm control',
        async () => {
            const quantum = await seedQuantumSigner()
            const { request, approve, reject } = buildArbitraryDataSignRequest({
                messages: [{ signer: quantum.address }],
            })

            renderSignReview(request)

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('arbitrary-data-quantum-blocked'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )
            // The harness renders i18n keys verbatim, so assert on the key.
            expect(
                screen.getByText('quantum.data_signing_unsupported.title'),
            ).toBeTruthy()
            expect(
                screen.queryByTestId('arbitrary-data-confirm-slide'),
            ).toBeNull()

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
