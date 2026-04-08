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
import { isHardwareWalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    HardwareWalletTransport,
    HardwareWalletRegistry,
    HardwareWalletTransportProvider,
} from '@perawallet/wallet-core-hardware-wallet'
import type {
    PeraTransaction,
    PeraSignedTransaction,
} from '@perawallet/wallet-core-blockchain'
import { Address } from '@perawallet/wallet-core-blockchain'
import type {
    SigningStrategy,
    AnalyzedSignableGroup,
    TransactionSignableData,
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
    hardwareWalletRegistry?: HardwareWalletRegistry
    encodeTransaction: EncodeTransactionFunction
}

/**
 * Validate preconditions and extract hardware account details.
 */
const validateAndExtract = (
    group: AnalyzedSignableGroup,
    account: WalletAccount,
    registry?: HardwareWalletRegistry,
): {
    hwAccount: HardwareWalletAccount
    transportProvider: HardwareWalletTransportProvider
    data: TransactionSignableData
} => {
    if (!isHardwareWalletAccount(account)) {
        throw new CannotSignError(
            account.address,
            'Account is not a hardware wallet',
        )
    }

    if (group.data.type !== 'transactions') {
        throw new HardwareWalletError('unsupported_data_type')
    }

    const hwAccount = account as HardwareWalletAccount
    const transportProvider = registry?.getProvider(
        hwAccount.hardwareDetails.manufacturer,
    )

    if (!transportProvider) {
        throw new HardwareWalletError('transport_unavailable')
    }

    return { hwAccount, transportProvider, data: group.data }
}

/**
 * Connect to the hardware device and verify it is ready.
 */
const connectAndVerify = async (
    transportProvider: HardwareWalletTransportProvider,
    deviceId: string,
    accountIndex: number,
    callbacks?: SigningCallbacks,
): Promise<HardwareWalletTransport> => {
    callbacks?.onPhaseChange?.('connecting')
    const transport = await transportProvider.connect(deviceId)
    await transport.getAddress(accountIndex, false)
    callbacks?.onPhaseChange?.('awaiting-approval')
    return transport
}

/**
 * Sign each transaction sequentially on the hardware device.
 *
 * Hardware wallet transports are typically single-channel —
 * concurrent commands can corrupt state or reorder responses.
 */
const signTransactions = async (
    transport: HardwareWalletTransport,
    data: TransactionSignableData,
    hwAccount: HardwareWalletAccount,
    encodeTransaction: EncodeTransactionFunction,
    callbacks?: SigningCallbacks,
): Promise<PeraSignedTransaction[]> => {
    const { transactions, indicesToSign } = data
    const { accountIndex } = hwAccount.hardwareDetails

    callbacks?.onSigningStart?.()
    const signed: PeraSignedTransaction[] = []

    for (let index = 0; index < transactions.length; index++) {
        const txn = transactions[index]
        callbacks?.onProgress?.(index + 1, transactions.length)

        if (!indicesToSign.includes(index)) {
            signed.push({ txn } as PeraSignedTransaction)
            continue
        }

        const txnBytes = encodeTransaction(txn)
        const signature = await transport.signTransaction(
            accountIndex,
            txnBytes,
        )

        const senderAddress = txn.sender.toString()
        const authAddress =
            hwAccount.address !== senderAddress
                ? Address.fromString(hwAccount.address)
                : undefined

        signed.push({
            txn,
            sig: signature,
            authAddress,
        } as PeraSignedTransaction)
    }

    callbacks?.onSigningComplete?.()
    return signed
}

/**
 * Classify and re-throw errors with proper types.
 */
const classifyError = (error: unknown): never => {
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
}

/**
 * Creates a signing strategy for hardware wallets.
 * These accounts require device interaction with user prompts.
 */
export const createHardwareStrategy = (
    options: HardwareStrategyOptions,
): SigningStrategy => {
    const { hardwareWalletRegistry, encodeTransaction } = options

    return {
        canSign: (account: WalletAccount): boolean => {
            return isHardwareWalletAccount(account)
        },

        sign: async (
            group: AnalyzedSignableGroup,
            account: WalletAccount,
            callbacks?: SigningCallbacks,
        ): Promise<SigningResult> => {
            const { hwAccount, transportProvider, data } =
                validateAndExtract(group, account, hardwareWalletRegistry)

            const { deviceId, accountIndex } = hwAccount.hardwareDetails
            let transport: HardwareWalletTransport | undefined

            try {
                transport = await connectAndVerify(
                    transportProvider,
                    deviceId,
                    accountIndex,
                    callbacks,
                )

                const signed = await signTransactions(
                    transport,
                    data,
                    hwAccount,
                    encodeTransaction,
                    callbacks,
                )

                return {
                    signedData: { type: 'transactions', signed },
                    signers: [{ address: account.address }],
                    originalIndices: group.originalIndices,
                }
            } catch (error) {
                callbacks?.onError?.(
                    error instanceof Error ? error : new Error(String(error)),
                )
                return classifyError(error)
            } finally {
                try {
                    await transport?.disconnect()
                } catch {
                    // Swallow disconnect errors to preserve original error
                }
            }
        },
    }
}
