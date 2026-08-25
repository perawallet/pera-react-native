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
    vi,
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
    buildArc60SignRequest,
    fireEvent,
    renderSignReview,
    screen,
    waitFor,
    REVIEW_SIGNER_ADDRESS,
    REVIEW_RECEIVER_ADDRESS,
    seedAlgo25Signer,
    seedQuantumSigner,
} from '@test-utils/signing-review'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    buildArc60AuthSigningPayload,
    decodeArc60Data,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import { getProvider } from '@perawallet/wallet-extension-provider'

const SLOW_TEST_TIMEOUT_MS = 30_000

// The rekeyed signer holds no key of its own (empty keyPairId), so the only
// way to prove the AUTH account's key produced the signature is to spy on
// the keystore primitive and inspect which childKeyId it was called with —
// the test keystore's ed25519 `sign()` returns a fixed-length stub regardless
// of key, so signature bytes alone can't distinguish the two (PERA-4977).
const REKEYED_SIGNER_ADDRESS = REVIEW_RECEIVER_ADDRESS
const AUTH_ADDRESS = REVIEW_SIGNER_ADDRESS

/**
 * `renderSignReview` enqueues into a persisted store that nothing drains when
 * a test ends, so the review a later test renders is the FIRST request still
 * pending — an earlier test's. Every assertion here would then be made
 * against the wrong signer, which is exactly how a rekey case below could
 * pass while the bug it covers is present.
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
        drainPendingSignRequests()
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

    it(
        'Given a SIWA request whose signer is rekeyed to a held local key, when the user confirms, then the auth account signs — not the rekeyed account',
        async () => {
            const authSigner = await seedAlgo25Signer()
            const rekeyedSigner: WalletAccount = {
                id: 'rekeyed-arc60-signer',
                type: AccountTypes.watch,
                address: REKEYED_SIGNER_ADDRESS,
                rekeyAddress: AUTH_ADDRESS,
                name: 'Rekeyed SIWA signer',
            }
            useAccountsStore.getState().setAccounts([rekeyedSigner, authSigner])

            const { request, approve, reject } = buildArc60SignRequest({
                domain: 'arc60.io',
                signer: REKEYED_SIGNER_ADDRESS,
            })

            const signSpy = vi.spyOn(getProvider().key.store, 'sign')

            const { confirm } = renderSignReview(request)

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('arc60-confirm-slide'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )

            confirm('arc60-confirm-slide')

            await waitFor(
                () => {
                    expect(approve).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
            expect(reject).not.toHaveBeenCalled()

            const delivered = approve.mock.calls[0][0]
            expect(delivered[0].signature).toBeInstanceOf(Uint8Array)

            // The rekeyed account carries no keyPairId at all, so a sign
            // routed through it would be structurally impossible to observe
            // here — the childKeyId the keystore actually signed with is the
            // only place the auth-hop is provable.
            expect(signSpy).toHaveBeenCalledTimes(1)
            expect(signSpy.mock.calls[0][0]).toBe(authSigner.keyPairId)

            // The signed bytes per PERA-4977: two concatenated SHA-256
            // digests of the decoded SIWA payload and the authenticatorData.
            const decodedData = decodeArc60Data(
                request.stdSigData.data,
                request.metadata.encoding,
            )
            const expectedPayload = buildArc60AuthSigningPayload(
                decodedData,
                request.stdSigData.authenticatorData,
            )
            expect(signSpy.mock.calls[0][1]).toEqual(expectedPayload)

            signSpy.mockRestore()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
