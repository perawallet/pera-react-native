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

// LRK-022 cross-cutting coverage: the swap suites only exercised the two
// Pera-API boundaries with local-key senders. These cases drive the full
// prepare → sign → submit → status flow with a Ledger sender (device-approval
// overlay to submission — guards the LRK-002/003/012 machine fixes at flow
// level) and with a rekeyed sender (auth signs, sgnr stamped on the wire).

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'
import React, { useEffect, useRef } from 'react'
import { http, HttpResponse } from 'msw'
import { Decimal } from 'decimal.js'
import { decodeSignedTransaction } from 'algosdk'

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
    seedAlgo25Signer,
    fireEvent,
    screen,
    waitFor,
    REVIEW_SIGNER_ADDRESS,
    REVIEW_RECEIVER_ADDRESS,
} from '@test-utils/signing-review'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { LedgerUserRejectedError } from '@perawallet/wallet-core-ledger'
import {
    AccountTypes,
    useAccountsStore,
    type HardwareWalletAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { encodeTransaction } from '@perawallet/wallet-core-blockchain'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { SigningOverlays } from '@modules/signing/components/SigningOverlays'
import {
    useSwapExecution,
    type SwapExecutionOutcome,
} from '@modules/swap/hooks/useSwapExecution'

import type { SwapQuote } from '@perawallet/wallet-core-swaps'

const SLOW_TEST_TIMEOUT_MS = 30_000
const SWAP_ID = '98765'
const LEDGER_ADDRESS = REVIEW_RECEIVER_ADDRESS
const AUTH_ADDRESS = REVIEW_SIGNER_ADDRESS

type Deferred<T> = {
    promise: Promise<T>
    resolve: (value: T) => void
    reject: (error: Error) => void
}
const createDeferred = <T,>(): Deferred<T> => {
    let resolveFn!: (value: T) => void
    let rejectFn!: (error: Error) => void
    const promise = new Promise<T>((res, rej) => {
        resolveFn = res
        rejectFn = rej
    })
    return { promise, resolve: resolveFn, reject: rejectFn }
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

// Captured from the host so tests can kick off the swap at controlled times.
let executeSwap: ((quote: SwapQuote) => Promise<SwapExecutionOutcome>) | null =
    null

const SwapHost = () => {
    const { execute } = useSwapExecution()
    const { setPreference } = usePreferences()
    const prepared = useRef(false)
    useEffect(() => {
        if (!prepared.current) {
            prepared.current = true
            setPreference('hasSeenTransactionRequestFAQ', true)
        }
        executeSwap = execute
    }, [execute, setPreference])
    return <SigningOverlays />
}

const buildQuote = (swapperAddress: string): SwapQuote =>
    ({
        quoteIdStr: 'quote-ledger-1',
        swapperAddress,
        assetIn: { assetId: '0' },
        assetOut: { assetId: '31566704' },
        // Base units; the prepared payment below spends exactly this plus the
        // network fee, which validateSwapGroupAgainstQuote allows for.
        amountIn: new Decimal(1_000_000),
        peraFeeAmount: new Decimal(0),
        // Client-stamped freshness marker (PERA-4589): execute() refuses a
        // quote without a recent `fetchedAt` as stale before it ever reaches
        // prepare. Stamp it "now" so these signing-pipeline flows exercise a
        // fresh quote rather than tripping the staleness guard.
        fetchedAt: Date.now(),
    }) as unknown as SwapQuote

// One swap group with a single user-signable payment from `sender`.
const mockPrepareWithPayment = (sender: string) => {
    const unsigned = buildPaymentTransaction({
        sender,
        receiver: sender === AUTH_ADDRESS ? LEDGER_ADDRESS : AUTH_ADDRESS,
    })
    server.use(
        http.post('*/v2/dex-swap/prepare-transactions/', () =>
            HttpResponse.json(
                {
                    transaction_groups: [
                        {
                            purpose: 'swap' as const,
                            transaction_group_id: 'group-swap-1',
                            transactions: [
                                encodeToBase64(encodeTransaction(unsigned)),
                            ],
                            signed_transactions: [null],
                        },
                    ],
                    swap_id: 98_765,
                    swap_id_str: SWAP_ID,
                    swap_version: 'v2',
                },
                { status: 200 },
            ),
        ),
    )
}

const spyOnSubmissionAndStatus = () => {
    const algodBodies: Uint8Array[] = []
    const statusPayloads: Array<Record<string, unknown>> = []
    server.use(
        http.post('*/v2/transactions', async ({ request }) => {
            algodBodies.push(new Uint8Array(await request.arrayBuffer()))
            return HttpResponse.json(
                {
                    txId: 'SWAPLEDGERTXID00000000000000000000000000000000000001',
                },
                { status: 200 },
            )
        }),
        // Background confirmation poll after submit — keep it green so the
        // flow's void confirmation branch settles quietly.
        http.get('*/v2/transactions/pending/*', () =>
            HttpResponse.json(
                { 'confirmed-round': 101, 'pool-error': '' },
                { status: 200 },
            ),
        ),
        http.get('*/v2/status', () =>
            HttpResponse.json({ 'last-round': 100 }, { status: 200 }),
        ),
        http.patch(`*/v2/dex-swap/swaps/${SWAP_ID}/`, async ({ request }) => {
            const payload = (await request.json()) as Record<string, unknown>
            statusPayloads.push(payload)
            return HttpResponse.json(
                { swap_version: 'v2', ...payload },
                { status: 200 },
            )
        }),
    )
    return { algodBodies, statusPayloads }
}

describe('Flow: Swap with a Ledger / rekeyed sender through the signing pipeline', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
        registerFakeLedgerProvider()
    })
    afterEach(() => {
        server.resetHandlers()
        pendingSignature = null
        executeSwap = null
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
    })

    it(
        'Given a Ledger sender, when the user approves on the device, then the swap submits to algod and reports in_progress with the txn ids',
        async () => {
            useAccountsStore.getState().setAccounts([ledgerAccount])
            useAccountsStore
                .getState()
                .setSelectedAccountAddress(LEDGER_ADDRESS)
            mockPrepareWithPayment(LEDGER_ADDRESS)
            const { algodBodies, statusPayloads } = spyOnSubmissionAndStatus()

            renderWithNavigation(SwapHost, 'SwapLedgerHost')
            await waitFor(() => expect(executeSwap).not.toBeNull())

            let outcome: SwapExecutionOutcome | null = null
            const run = executeSwap!(buildQuote(LEDGER_ADDRESS)).then(o => {
                outcome = o
            })

            // The device-approval overlay surfaces while the exchange is
            // parked on the Ledger prompt.
            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('ledger-signing-overlay-lottie'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )
            expect(algodBodies).toHaveLength(0)

            pendingSignature!.resolve(new Uint8Array(64))
            await run

            expect(outcome).toEqual({ kind: 'success' })
            expect(algodBodies).toHaveLength(1)
            expect(statusPayloads).toHaveLength(1)
            expect(statusPayloads[0].status).toBe('in_progress')
            expect(statusPayloads[0].submitted_transaction_ids).toHaveLength(1)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a Ledger sender, when the device rejects, then the swap resolves as cancelled and the backend never receives a failure report',
        async () => {
            // LRK-012 swap contract: an on-device reject is a user cancel —
            // reportSwapFailure (status failed/blockchain_error) must stay
            // unreachable, and nothing may reach algod.
            useAccountsStore.getState().setAccounts([ledgerAccount])
            useAccountsStore
                .getState()
                .setSelectedAccountAddress(LEDGER_ADDRESS)
            mockPrepareWithPayment(LEDGER_ADDRESS)
            const { algodBodies, statusPayloads } = spyOnSubmissionAndStatus()

            renderWithNavigation(SwapHost, 'SwapLedgerHost')
            await waitFor(() => expect(executeSwap).not.toBeNull())

            let outcome: SwapExecutionOutcome | null = null
            const run = executeSwap!(buildQuote(LEDGER_ADDRESS)).then(o => {
                outcome = o
            })

            await waitFor(
                () => {
                    expect(pendingSignature).not.toBeNull()
                },
                { timeout: 10_000 },
            )
            pendingSignature!.reject(new LedgerUserRejectedError())

            // The Ledger error sheet offers Retry and Cancel — cancel out.
            await waitFor(
                () => {
                    expect(
                        screen.getByText('ledger.signing.cancel'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )
            fireEvent.click(screen.getByText('ledger.signing.cancel'))
            await run

            expect(outcome).toEqual({ kind: 'cancelled' })
            expect(algodBodies).toHaveLength(0)
            expect(statusPayloads).toHaveLength(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a sender rekeyed to a held local key, when the swap signs headlessly, then the auth key signs and the submitted blob carries sgnr',
        async () => {
            const authSigner = await seedAlgo25Signer()
            const rekeyedSender: WalletAccount = {
                id: 'rekeyed-swapper',
                type: AccountTypes.watch,
                address: LEDGER_ADDRESS,
                rekeyAddress: AUTH_ADDRESS,
                name: 'Rekeyed swapper',
            }
            useAccountsStore.getState().setAccounts([rekeyedSender, authSigner])
            useAccountsStore
                .getState()
                .setSelectedAccountAddress(rekeyedSender.address)
            mockPrepareWithPayment(rekeyedSender.address)
            const { algodBodies, statusPayloads } = spyOnSubmissionAndStatus()

            renderWithNavigation(SwapHost, 'SwapLedgerHost')
            await waitFor(() => expect(executeSwap).not.toBeNull())

            const outcome = await executeSwap!(
                buildQuote(rekeyedSender.address),
            )

            expect(outcome).toEqual({ kind: 'success' })
            expect(algodBodies).toHaveLength(1)
            const signed = decodeSignedTransaction(algodBodies[0])
            expect(signed.txn.sender.toString()).toBe(rekeyedSender.address)
            expect(signed.sgnr?.toString()).toBe(AUTH_ADDRESS)
            expect(statusPayloads[0]?.status).toBe('in_progress')
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
