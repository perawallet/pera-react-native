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

// A headless Ledger send parked on the device prompt must not have its
// signing hijacked by an arriving interactive (WalletConnect) request: the
// review sheet stays closed until the hardware sign settles, then opens bound
// to the WC request — and Decline targets the WC request, never the send.

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
import React, { useEffect, useRef } from 'react'
import { act } from '@testing-library/react'

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
    seedAlgo25Signer,
    screen,
    waitFor,
    fireEvent,
    REVIEW_SIGNER_ADDRESS,
    REVIEW_RECEIVER_ADDRESS,
} from '@test-utils/signing-review'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import {
    AccountTypes,
    useAccountsStore,
    type HardwareWalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useSigningRequest,
    type SignRequest,
} from '@perawallet/wallet-core-signing'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { SigningOverlays } from '@modules/signing/components/SigningOverlays'

const SLOW_TEST_TIMEOUT_MS = 30_000

const LEDGER_ADDRESS = REVIEW_RECEIVER_ADDRESS

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void }
const createDeferred = <T,>(): Deferred<T> => {
    let resolveFn!: (value: T) => void
    const promise = new Promise<T>(res => {
        resolveFn = res
    })
    return { promise, resolve: resolveFn }
}

let pendingSignature: Deferred<Uint8Array> | null = null

const registerFakeLedgerProvider = () => {
    getProvider().hardwareWalletRegistry.register({
        manufacturer: 'ledger',
        transportType: 'ble',
        scan: () => () => {},
        connect: async () => ({
            getAddress: async (accountIndex: number) => ({
                address: LEDGER_ADDRESS,
                publicKey: new Uint8Array(32),
                accountIndex,
            }),
            signTransaction: async () => {
                pendingSignature = createDeferred<Uint8Array>()
                return pendingSignature.promise
            },
            signData: async () => new Uint8Array(64),
            getAppVersion: async () => ({ major: 0, minor: 0, patch: 0 }),
            disconnect: async () => {},
        }),
        isSupported: async () => false,
    })
}

const ledgerAccount: HardwareWalletAccount = {
    id: 'hw-ledger-1',
    type: AccountTypes.hardware,
    address: LEDGER_ADDRESS,
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'test-device-id',
        deviceName: 'Ledger Nano X',
        accountIndex: 0,
        transportType: 'ble',
    },
}

// Captured from the host so the test can enqueue requests at controlled times.
let enqueue: ((request: SignRequest) => void) | null = null

const OverlapHost = () => {
    const { addSignRequest } = useSigningRequest()
    const { setPreference } = usePreferences()
    const prepared = useRef(false)
    useEffect(() => {
        if (prepared.current) return
        prepared.current = true
        setPreference('hasSeenTransactionRequestFAQ', true)
        enqueue = addSignRequest
    }, [addSignRequest, setPreference])
    return <SigningOverlays />
}

describe('Flow: interactive request arriving during a headless hardware sign', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
        registerFakeLedgerProvider()
    })
    afterEach(() => {
        server.resetHandlers()
        pendingSignature = null
        enqueue = null
    })
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        const signer = await seedAlgo25Signer()
        useAccountsStore.getState().setAccounts([signer, ledgerAccount])
    })

    it(
        'defers the WC review sheet until the hardware send settles and Decline targets only the WC request',
        async () => {
            renderWithNavigation(OverlapHost, 'SignOverlapHost')
            await waitFor(() => expect(enqueue).not.toBeNull())

            // S: headless Ledger send — auto-approved (no review sheet) and
            // parked on the hanging device signature.
            const headlessSend = buildTransactionSignRequest({
                sourceType: 'local',
                txs: [
                    buildPaymentTransaction({
                        sender: LEDGER_ADDRESS,
                        receiver: REVIEW_SIGNER_ADDRESS,
                    }),
                ],
            })
            act(() => enqueue!(headlessSend.request))

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('ledger-signing-overlay-lottie'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )

            // W: an interactive WC request arrives while S is on-device.
            const wcRequest = buildTransactionSignRequest({
                sourceType: 'walletconnect',
                txs: [
                    buildPaymentTransaction({
                        sender: REVIEW_SIGNER_ADDRESS,
                        receiver: LEDGER_ADDRESS,
                        amount: 2_500_000n,
                    }),
                ],
            })
            act(() => enqueue!(wcRequest.request))

            // The review sheet must stay closed while the hardware sign is in
            // flight for the other request — no review view mounted at all.
            await act(async () => {
                await new Promise(resolve => setTimeout(resolve, 100))
            })
            expect(screen.queryByTestId('sign-request-view')).toBeNull()
            expect(screen.queryByTestId('signing-confirm-slide')).toBeNull()

            // Release the device signature — S completes and delivers.
            expect(pendingSignature).not.toBeNull()
            await act(async () => {
                pendingSignature!.resolve(new Uint8Array(64))
            })
            await waitFor(
                () => {
                    expect(headlessSend.approve).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )

            // The deferred WC sheet now opens, bound to W's own content.
            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('signing-confirm-slide'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )

            // Decline targets W — never the (already completed) send.
            fireEvent.click(screen.getByText('common.cancel.label'))
            await waitFor(
                () => {
                    expect(wcRequest.reject).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
            expect(headlessSend.reject).not.toHaveBeenCalled()
            expect(headlessSend.approve).toHaveBeenCalledTimes(1)

            vi.restoreAllMocks()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
