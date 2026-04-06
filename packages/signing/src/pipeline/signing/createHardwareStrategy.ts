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

import type {
    WalletAccount,
    HardwareWalletAccount,
} from '@perawallet/wallet-core-accounts'
import { isLedgerAccount } from '@perawallet/wallet-core-accounts'
import type { LedgerTransportProvider } from '@perawallet/wallet-core-ledger'
import type {
    PeraTransaction,
    PeraSignedTransaction,
} from '@perawallet/wallet-core-blockchain'
import { Address } from '@perawallet/wallet-core-blockchain'
import type {
    SigningStrategy,
    AnalyzedSignableGroup,
    SigningResult,
    SigningCallbacks,
} from '../types'
import { CannotSignError, HardwareWalletError, SigningError } from '../errors'

/**
 * Function to encode a transaction to raw bytes for the Ledger to sign.
 * Injected from the hook layer (useTransactionEncoder).
 */
export type EncodeTransactionFunction = (tx: PeraTransaction) => Uint8Array

export type HardwareStrategyOptions = {
    transportProvider?: LedgerTransportProvider
    encodeTransaction: EncodeTransactionFunction
}

/**
 * Creates a signing strategy for hardware wallets (Ledger).
 * These accounts require device interaction with user prompts.
 */
export const createHardwareStrategy = (
    options: HardwareStrategyOptions,
): SigningStrategy => {
    const { transportProvider, encodeTransaction } = options

    return {
        canSign: (account: WalletAccount): boolean => {
            return isLedgerAccount(account)
        },

        sign: async (
            group: AnalyzedSignableGroup,
            account: WalletAccount,
            callbacks?: SigningCallbacks,
        ): Promise<SigningResult> => {
            if (!isLedgerAccount(account)) {
                throw new CannotSignError(
                    account.address,
                    'Account is not a hardware wallet',
                )
            }

            if (!transportProvider) {
                throw new HardwareWalletError(
                    'Ledger BLE transport is not available on this platform',
                )
            }

            if (group.data.type !== 'transactions') {
                throw new HardwareWalletError(
                    'Ledger only supports transaction signing',
                )
            }

            const hwAccount = account as HardwareWalletAccount
            const { deviceId, accountIndex } = hwAccount.hardwareDetails

            // Step 1: Connect to the Ledger device
            await callbacks?.onHardwarePrompt?.({
                type: 'connect',
                message: 'Connecting to Ledger device...',
            })

            const transport = await transportProvider.connect(deviceId)

            try {
                // Step 2: Verify the Algorand app is open by fetching address
                await transport.getAddress(0, false)

                // Step 3: Prompt user to confirm on device
                await callbacks?.onHardwarePrompt?.({
                    type: 'approve',
                    message:
                        'Please review and approve the transaction on your Ledger device.',
                })

                const { transactions, indicesToSign } = group.data

                // Step 4: Sign each transaction
                const signed: PeraSignedTransaction[] = await Promise.all(
                    transactions.map(async (txn, index) => {
                        callbacks?.onProgress?.(index + 1, transactions.length)

                        // Only sign transactions in indicesToSign
                        if (!indicesToSign.includes(index)) {
                            return { txn } as PeraSignedTransaction
                        }

                        const txnBytes = encodeTransaction(txn)
                        const signature = await transport.signTransaction(
                            accountIndex,
                            txnBytes,
                        )

                        // Build SignedTransaction: { txn, sig, authAddress? }
                        const senderAddress = txn.sender.toString()
                        const authAddress =
                            hwAccount.address !== senderAddress
                                ? Address.fromString(hwAccount.address)
                                : undefined

                        return {
                            txn,
                            sig: signature,
                            authAddress,
                        } as PeraSignedTransaction
                    }),
                )

                callbacks?.onSigningComplete?.()

                return {
                    signedData: {
                        type: 'transactions',
                        signed,
                    },
                    signers: [{ address: account.address }],
                    originalIndices: group.originalIndices,
                }
            } catch (error) {
                if (
                    error instanceof CannotSignError ||
                    error instanceof HardwareWalletError
                ) {
                    throw error
                }
                throw new SigningError(
                    error instanceof Error ? error.message : String(error),
                    error instanceof Error ? error : undefined,
                )
            } finally {
                await transport.disconnect()
            }
        },
    }
}
