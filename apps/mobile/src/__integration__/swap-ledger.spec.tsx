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

// Drives the full order → sign → submit → report swap flow with a Ledger
// sender (device-approval overlay through submission) and with a rekeyed
// sender (auth signs, sgnr stamped on the wire).

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
import { decodeSignedTransaction } from 'algosdk'

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
    useAccountChainStateStore,
    useAccountsStore,
    type HardwareWalletAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { mockAlgodAccountInformation } from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { SigningOverlays } from '@modules/signing/shell'
import {
    useSwapExecution,
    type SwapExecutionOutcome,
} from '@modules/swap/hooks/useSwapExecution'

import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import { registerFakeLedgerProvider } from './__fixtures__/ledger'
import { addressOf } from './__fixtures__/accounts'
import {
    buildRouterSwapQuote,
    mockSwapOrderWithPayment,
    spyOnSwapSubmissionAndReports,
} from './__fixtures__/swapRouter'

const LEDGER_ADDRESS = REVIEW_RECEIVER_ADDRESS
const AUTH_ADDRESS = REVIEW_SIGNER_ADDRESS

let pendingSignature: PromiseWithResolvers<Uint8Array> | null = null

const blockOnSignature = (): Promise<Uint8Array> => {
    pendingSignature = Promise.withResolvers<Uint8Array>()
    return pendingSignature.promise
}

const ledgerAccount: HardwareWalletAccount = {
    id: 'hw-ledger-1',
    name: '',
    custody: {
        kind: 'hardware',
        device: {
            manufacturer: 'ledger',
            deviceId: 'test-device-id',
            deviceName: 'Ledger Nano X',
            transportType: 'ble',
        },
        accountIndex: 0,
    },
    chains: { algorand: { address: LEDGER_ADDRESS } },
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

// One swap step with a single user-signable payment from `sender`.
const mockOrderWithPayment = (sender: string) =>
    mockSwapOrderWithPayment({
        sender,
        receiver: sender === AUTH_ADDRESS ? LEDGER_ADDRESS : AUTH_ADDRESS,
    })

describe('Flow: Swap with a Ledger / rekeyed sender through the signing pipeline', () => {
    beforeAll(async () => {
        await setupTestDatabase()
        registerFakeLedgerProvider({
            address: LEDGER_ADDRESS,
            signTransaction: blockOnSignature,
        })
    })
    afterEach(() => {
        pendingSignature = null
        executeSwap = null
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useAccountChainStateStore.getState().resetState()
        // execute() runs a balance preflight against algod before the order;
        // fund the senders so the 1-ALGO quote (plus fees and the receive
        // asset's opt-in MBR) clears it.
        server.use(
            mockAlgodAccountInformation({
                address: LEDGER_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
            mockAlgodAccountInformation({
                address: AUTH_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
        )
    })

    it('Given a Ledger sender, when the user approves on the device, then the swap submits to algod and reports the order sent with its txn id', async () => {
        useAccountsStore.getState().setAccounts([ledgerAccount])
        useAccountsStore.getState().setSelectedAccountId(ledgerAccount.id)
        mockOrderWithPayment(LEDGER_ADDRESS)
        const { algodBodies, reports } = spyOnSwapSubmissionAndReports()

        renderWithNavigation(SwapHost, 'SwapLedgerHost')
        await waitFor(() => expect(executeSwap).not.toBeNull())

        let outcome: SwapExecutionOutcome | null = null
        const run = executeSwap!(buildRouterSwapQuote(LEDGER_ADDRESS)).then(
            o => {
                outcome = o
            },
        )

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

        await waitFor(() => expect(pendingSignature).not.toBeNull())
        pendingSignature!.resolve(new Uint8Array(64))
        await run

        expect(outcome).toEqual({ kind: 'success' })
        expect(algodBodies).toHaveLength(1)
        expect(reports).toHaveLength(1)
        expect(reports[0].status).toBe('sent')
        expect(reports[0].transactions).toHaveLength(1)
    })

    it('Given a Ledger sender, when the device rejects, then the swap resolves as cancelled and the order is reported cancelled', async () => {
        // An on-device reject is a user cancel: nothing may reach algod, and
        // the order is released rather than left pending.
        useAccountsStore.getState().setAccounts([ledgerAccount])
        useAccountsStore.getState().setSelectedAccountId(ledgerAccount.id)
        mockOrderWithPayment(LEDGER_ADDRESS)
        const { algodBodies, reports } = spyOnSwapSubmissionAndReports()

        renderWithNavigation(SwapHost, 'SwapLedgerHost')
        await waitFor(() => expect(executeSwap).not.toBeNull())

        let outcome: SwapExecutionOutcome | null = null
        const run = executeSwap!(buildRouterSwapQuote(LEDGER_ADDRESS)).then(
            o => {
                outcome = o
            },
        )

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
                expect(screen.getByText('ledger.signing.cancel')).toBeTruthy()
            },
            { timeout: 10_000 },
        )
        fireEvent.click(screen.getByText('ledger.signing.cancel'))
        await run

        expect(outcome).toEqual({ kind: 'cancelled' })
        expect(algodBodies).toHaveLength(0)
        await waitFor(() => expect(reports).toEqual([{ status: 'cancelled' }]))
    })

    it('Given a sender rekeyed to a held local key, when the swap signs headlessly, then the auth key signs and the submitted blob carries sgnr', async () => {
        const authSigner = await seedAlgo25Signer()
        const rekeyedSender: WalletAccount = {
            id: 'rekeyed-swapper',
            custody: { kind: 'watch' },
            chains: { algorand: { address: LEDGER_ADDRESS } },
            name: 'Rekeyed swapper',
        }
        seedAuthority(LEDGER_ADDRESS, AUTH_ADDRESS)
        useAccountsStore.getState().setAccounts([rekeyedSender, authSigner])
        useAccountsStore.getState().setSelectedAccountId(rekeyedSender.id)
        mockOrderWithPayment(addressOf(rekeyedSender))
        const { algodBodies, reports } = spyOnSwapSubmissionAndReports()

        renderWithNavigation(SwapHost, 'SwapLedgerHost')
        await waitFor(() => expect(executeSwap).not.toBeNull())

        const outcome = await executeSwap!(
            buildRouterSwapQuote(addressOf(rekeyedSender)),
        )

        expect(outcome).toEqual({ kind: 'success' })
        expect(algodBodies).toHaveLength(1)
        const signed = decodeSignedTransaction(algodBodies[0])
        expect(signed.txn.sender.toString()).toBe(addressOf(rekeyedSender))
        expect(signed.sgnr?.toString()).toBe(AUTH_ADDRESS)
        expect(reports[0]?.status).toBe('sent')
    })
})
