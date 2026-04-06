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

import { setup, fromPromise, assign } from 'xstate'
import type {
    WalletAccount,
    HardwareWalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    LedgerTransportProvider,
    LedgerTransport,
} from '@perawallet/wallet-core-ledger'
import type {
    PeraTransaction,
    PeraSignedTransaction,
} from '@perawallet/wallet-core-blockchain'
import { Address } from '@perawallet/wallet-core-blockchain'
import type {
    AnalyzedSignableGroup,
    SigningResult,
} from '../../../pipeline/types'
import { HardwareWalletError } from '../../../pipeline/errors'
import type { EncodeTransactionFunction } from '../../../pipeline/signing/createHardwareStrategy'

export type LedgerSigningMachineInput = {
    group: AnalyzedSignableGroup
    signerAccount: WalletAccount
    transportProvider: LedgerTransportProvider
    encodeTransaction: EncodeTransactionFunction
}

type LedgerSigningMachineContext = {
    group: AnalyzedSignableGroup
    signerAccount: WalletAccount
    transportProvider: LedgerTransportProvider
    encodeTransaction: EncodeTransactionFunction
    transport: LedgerTransport | null
    signingResult: SigningResult | null
    error: Error | null
}

/**
 * How long to wait for the user to physically confirm on the Ledger device
 * before transitioning to `timed_out`.
 */
const LEDGER_CONFIRMATION_TIMEOUT_MS = 30_000

/**
 * XState sub-machine for Ledger BLE signing.
 *
 * State flow:
 *   connecting_ble → device_ready → awaiting_confirmation → signed
 *                 ↘             ↘                        ↘ failed
 *                                                        ↘ timed_out
 *
 * To add a new hardware wallet brand:
 *   1. Add a new actor file alongside this one (e.g. trezorSigningMachine.ts)
 *   2. Add a new guard (e.g. isTrezorType) in signingMachine.ts
 *   3. Add a new `trezor` child state in the `signing` state
 *   Zero other changes required.
 */
export const ledgerSigningMachine = setup({
    types: {
        input: {} as LedgerSigningMachineInput,
        context: {} as LedgerSigningMachineContext,
        output: {} as SigningResult,
    },
    actors: {
        /**
         * Connect to the Ledger device via BLE.
         */
        connectBle: fromPromise<
            LedgerTransport,
            { transportProvider: LedgerTransportProvider; deviceId: string }
        >(async ({ input }) => {
            return input.transportProvider.connect(input.deviceId)
        }),

        /**
         * Verify the Algorand app is open on the connected Ledger device.
         */
        prepareDevice: fromPromise<void, { transport: LedgerTransport }>(
            async ({ input }) => {
                // Fetching address at index 0 as a health check.
                // Throws LedgerAppNotOpenError if the Algorand app is not open.
                await input.transport.getAddress(0, false)
            },
        ),

        /**
         * Send each transaction in the group to the device for signing.
         * Resolves once the user physically confirms all transactions.
         */
        signOnDevice: fromPromise<
            SigningResult,
            {
                group: AnalyzedSignableGroup
                signerAccount: HardwareWalletAccount
                transport: LedgerTransport
                encodeTransaction: EncodeTransactionFunction
            }
        >(async ({ input }) => {
            const { group, signerAccount, transport, encodeTransaction } = input

            if (group.data.type !== 'transactions') {
                throw new HardwareWalletError(
                    'Ledger only supports transaction signing',
                )
            }

            const { transactions, indicesToSign } = group.data
            const { accountIndex } = signerAccount.hardwareDetails

            const signed: PeraSignedTransaction[] = await Promise.all(
                transactions.map(
                    async (txn: PeraTransaction, index: number) => {
                        if (!indicesToSign.includes(index)) {
                            return { txn } as PeraSignedTransaction
                        }

                        const txnBytes = encodeTransaction(txn)
                        const signature = await transport.signTransaction(
                            accountIndex,
                            txnBytes,
                        )

                        const senderAddress = txn.sender.toString()
                        const authAddress =
                            signerAccount.address !== senderAddress
                                ? Address.fromString(signerAccount.address)
                                : undefined

                        return {
                            txn,
                            sig: signature,
                            authAddress,
                        } as PeraSignedTransaction
                    },
                ),
            )

            return {
                signedData: { type: 'transactions', signed },
                signers: [{ address: signerAccount.address }],
                originalIndices: group.originalIndices,
            }
        }),
    },
    delays: {
        confirmationTimeout: LEDGER_CONFIRMATION_TIMEOUT_MS,
    },
}).createMachine({
    id: 'ledgerSigningMachine',

    context: ({ input }) => ({
        group: input.group,
        signerAccount: input.signerAccount,
        transportProvider: input.transportProvider,
        encodeTransaction: input.encodeTransaction,
        transport: null,
        signingResult: null,
        error: null,
    }),

    // Output is only meaningful when the machine reaches `signed`.
    // ledgerSignerActor is responsible for rejecting on failed/timed_out states.
    output: ({ context }) => context.signingResult as SigningResult,

    initial: 'connecting_ble',

    states: {
        /**
         * Establish a BLE connection to the Ledger device.
         * On success → device_ready.
         */
        connecting_ble: {
            invoke: {
                src: 'connectBle',
                input: ({ context }) => ({
                    transportProvider: context.transportProvider,
                    deviceId: (context.signerAccount as HardwareWalletAccount)
                        .hardwareDetails.deviceId,
                }),
                onDone: {
                    target: 'device_ready',
                    actions: assign({
                        transport: ({ event }) => event.output,
                    }),
                },
                onError: {
                    target: 'failed',
                    actions: assign({
                        error: ({ event }) => {
                            const e = event.error
                            return e instanceof Error ? e : new Error(String(e))
                        },
                    }),
                },
            },
        },

        /**
         * Device is connected. Verify the Algorand app is open.
         * On success → awaiting_confirmation.
         */
        device_ready: {
            invoke: {
                src: 'prepareDevice',
                input: ({ context }) => ({
                    transport: context.transport!,
                }),
                onDone: { target: 'awaiting_confirmation' },
                onError: {
                    target: 'failed',
                    actions: assign({
                        error: ({ event }) => {
                            const e = event.error
                            return e instanceof Error ? e : new Error(String(e))
                        },
                    }),
                },
            },
        },

        /**
         * Transactions have been sent to the device.
         * Waiting for the user to press the physical confirmation button.
         * Times out after LEDGER_CONFIRMATION_TIMEOUT_MS.
         */
        awaiting_confirmation: {
            invoke: {
                src: 'signOnDevice',
                input: ({ context }) => ({
                    group: context.group,
                    signerAccount:
                        context.signerAccount as HardwareWalletAccount,
                    transport: context.transport!,
                    encodeTransaction: context.encodeTransaction,
                }),
                onDone: {
                    target: 'signed',
                    actions: assign({
                        signingResult: ({ event }) => event.output,
                    }),
                },
                onError: {
                    target: 'failed',
                    actions: assign({
                        error: ({ event }) => {
                            const e = event.error
                            return e instanceof Error ? e : new Error(String(e))
                        },
                    }),
                },
            },
            after: {
                confirmationTimeout: { target: 'timed_out' },
            },
        },

        /** Signing succeeded — the machine output is the SigningResult. */
        signed: { type: 'final' },

        /** An error occurred at any stage (BLE failure, app not open, etc). */
        failed: { type: 'final' },

        /** User did not confirm within LEDGER_CONFIRMATION_TIMEOUT_MS. */
        timed_out: { type: 'final' },
    },
})
