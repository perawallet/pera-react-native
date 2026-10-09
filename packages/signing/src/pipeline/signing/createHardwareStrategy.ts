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

import type {
    WalletAccount,
    HardwareWalletAccount,
} from '@perawallet/wallet-core-accounts'
import { isHardwareWalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    HardwareWalletRegistry,
    HardwareWalletTransport,
} from '@perawallet/wallet-core-hardware-wallet'

import { encodeToBase64, withTimeout } from '@perawallet/wallet-core-shared'
import type {
    SigningStrategy,
    AnalyzedSignableGroup,
    PeraTransactionsSignableData,
    AuthData,
    AuthDataMetadata,
    SigningResult,
    SigningCallbacks,
    SignerInfo,
} from '../types'
import { isUnsignedTransactionsData } from '../types'
import { CannotSignError, HardwareWalletError, SigningError } from '../errors'
import {
    LEDGER_CONNECTION_TIMEOUT_MS,
    LEDGER_CONFIRMATION_TIMEOUT_MS,
} from '@perawallet/wallet-core-ledger'
import type {
    ChainId,
    PeraTransaction,
    PeraSignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import {
    plannerChainAdapters,
    type PlannerChainAdapter,
} from '../../chain-adapter'
import {
    messageSignerFor,
    type MessageSignerChainAdapter,
} from '../../message-signer'
import {
    ledgerTimeoutReason,
    throwIfAborted,
    withLedgerSession,
    type DisconnectGuard,
    type LedgerSessionOptions,
} from './withLedgerSession'

/**
 * Function to encode a transaction to raw bytes for the Ledger to sign.
 * Injected from the hook layer (the planner's `encodeUnsignedTransaction`).
 */
export type EncodeTransactionFunction = (tx: PeraTransaction) => Uint8Array

export type HardwareStrategyOptions = {
    hardwareWalletRegistry?: HardwareWalletRegistry
    encodeTransaction: EncodeTransactionFunction
    /** Read at auth-data sign time, for the signer / rekey cross-check. */
    getAllAccounts: () => WalletAccount[]
    chainId: ChainId
}

/**
 * Validate preconditions and extract hardware account details.
 */
const validateAndExtract = (
    group: AnalyzedSignableGroup,
    account: WalletAccount,
): {
    hwAccount: HardwareWalletAccount
    data: PeraTransactionsSignableData
} => {
    if (!isHardwareWalletAccount(account)) {
        throw new CannotSignError(
            account.address,
            'Account is not a hardware wallet',
        )
    }

    if (group.data.type === 'arbitrary-data') {
        throw new SigningError(
            'Hardware wallet signing of arbitrary data is not supported',
            undefined,
            // Retrying can never succeed — suppress the Retry affordance.
            { retryable: false },
        )
    }

    // The device's Algorand app signs Algorand transactions only.
    if (
        group.data.type !== 'transactions' ||
        isUnsignedTransactionsData(group.data)
    ) {
        throw new HardwareWalletError('unsupported_data_type')
    }

    return { hwAccount: account as HardwareWalletAccount, data: group.data }
}

/**
 * Sign each transaction sequentially on the hardware device.
 */
const signTransactions = async (
    transport: HardwareWalletTransport,
    data: PeraTransactionsSignableData,
    hwAccount: HardwareWalletAccount,
    encodeTransaction: EncodeTransactionFunction,
    planner: PlannerChainAdapter,
    guard: DisconnectGuard,
    callbacks?: SigningCallbacks,
): Promise<PeraSignedTransaction[]> => {
    const { transactions, indicesToSign } = data
    const { accountIndex } = hwAccount.hardwareDetails

    callbacks?.onSigningStart?.()
    const signed: PeraSignedTransaction[] = []

    for (let index = 0; index < transactions.length; index++) {
        // No APDU leaves the app after an abort — without this check the
        // detached loop would keep prompting the device for every remaining
        // transaction while the app already shows an error sheet.
        throwIfAborted(callbacks?.signal)

        const txn = transactions[index]

        if (!indicesToSign.includes(index)) {
            signed.push(planner.assembleSignedTransaction(txn))
            continue
        }

        // Progress counter reflects only signable transactions — skipped
        // indices (cosigned by another party) are not meaningful UI progress.
        callbacks?.onProgress?.(index + 1, transactions.length)

        // Signal that the user must now approve this transaction on the device.
        // Status transitions belong here (via onPhaseChange), not in onProgress,
        // so the overlay can render the approval chrome for each signable tx.
        callbacks?.onPhaseChange?.('awaiting-approval')

        const txnBytes = encodeTransaction(txn)
        // Sign-time timeout uses CONFIRMATION (5 min) not CONNECTION (20s) —
        // the user is reading the transaction on the device. The timeout
        // exists so a dropped BLE link mid-confirmation doesn't hang the
        // promise forever, not to bound the user's reading time.
        const signature = await withTimeout(
            guard.race(transport.signTransaction(accountIndex, txnBytes)),
            LEDGER_CONFIRMATION_TIMEOUT_MS,
            'Sign Ledger transaction',
            ledgerTimeoutReason('Sign Ledger transaction'),
        )

        signed.push(
            planner.assembleSignedTransaction(txn, {
                sig: signature,
                signerAddress: hwAccount.address,
            }),
        )
    }

    callbacks?.onSigningComplete?.()
    return signed
}

type SignTransactionsOnHardwareWalletOptions = LedgerSessionOptions & {
    encodeTransaction: EncodeTransactionFunction
    planner: PlannerChainAdapter
}

type SignAuthDataOnHardwareWalletOptions = LedgerSessionOptions & {
    messageSigner: MessageSignerChainAdapter
    getAllAccounts: () => WalletAccount[]
}

/**
 * Signs sequentially, returning a parallel array where everything outside
 * `indicesToSign` is an unsigned `{ txn }` placeholder.
 */
const signTransactionsOnHardwareWallet = (
    hwAccount: HardwareWalletAccount,
    transactions: PeraTransaction[],
    indicesToSign: number[],
    options: SignTransactionsOnHardwareWalletOptions,
): Promise<PeraSignedTransaction[]> => {
    const { encodeTransaction, planner, callbacks } = options

    return withLedgerSession(hwAccount, options, ({ transport, guard }) =>
        signTransactions(
            transport,
            { type: 'transactions', transactions, indicesToSign },
            hwAccount,
            encodeTransaction,
            planner,
            guard,
            callbacks,
        ),
    )
}

/** Gates on minimum app version and host-side validation before signing. */
const signAuthDataOnHardwareWallet = (
    hwAccount: HardwareWalletAccount,
    authData: AuthData,
    metadata: AuthDataMetadata,
    options: SignAuthDataOnHardwareWalletOptions,
): Promise<Uint8Array> => {
    const { messageSigner, getAllAccounts, callbacks } = options
    const { accountIndex } = hwAccount.hardwareDetails

    return withLedgerSession(
        hwAccount,
        options,
        async ({ transport, guard }) => {
            // Early version gate — the device-side error is the fallback.
            await withTimeout(
                transport.assertCanSignData(),
                LEDGER_CONNECTION_TIMEOUT_MS,
                'Read Ledger app version',
                ledgerTimeoutReason('Read Ledger app version'),
            )

            messageSigner.validateAuthData(authData, metadata, getAllAccounts())

            callbacks?.onSigningStart?.()
            callbacks?.onProgress?.(1, 1)

            const signature = await withTimeout(
                guard.race(
                    transport.signData({
                        accountIndex,
                        data: authData.data,
                        signerPublicKey: messageSigner.signerPublicKey(
                            hwAccount.address,
                        ),
                        domain: authData.domain,
                        authenticatorData: authData.authenticatorData,
                        requestId: authData.requestId,
                        scope: metadata.scope,
                        encoding: metadata.encoding,
                    }),
                ),
                LEDGER_CONFIRMATION_TIMEOUT_MS,
                'Sign Ledger data',
                ledgerTimeoutReason('Sign Ledger data'),
            )

            callbacks?.onSigningComplete?.()
            return signature
        },
    )
}

/**
 * Creates a signing strategy for hardware wallets.
 * These accounts require device interaction with user prompts.
 */
export const createHardwareStrategy = (
    options: HardwareStrategyOptions,
): SigningStrategy => {
    const {
        hardwareWalletRegistry,
        encodeTransaction,
        getAllAccounts,
        chainId,
    } = options

    return {
        canSign: (account: WalletAccount): boolean => {
            return isHardwareWalletAccount(account)
        },

        sign: async (
            group: AnalyzedSignableGroup,
            account: WalletAccount,
            callbacks?: SigningCallbacks,
        ): Promise<SigningResult> => {
            if (!isHardwareWalletAccount(account)) {
                throw new CannotSignError(
                    account.address,
                    'Account is not a hardware wallet',
                )
            }

            if (group.data.type === 'auth-data') {
                // Resolved before any Ledger session so a chain with no
                // message signer is refused without a device prompt.
                const messageSigner = messageSignerFor(chainId, account.address)
                const signature = await signAuthDataOnHardwareWallet(
                    account,
                    group.data.authData,
                    group.data.metadata,
                    {
                        registry: hardwareWalletRegistry,
                        messageSigner,
                        getAllAccounts,
                        callbacks,
                    },
                )
                return {
                    signedData: { type: 'auth-data', signature },
                    signers: [{ address: account.address }],
                    originalIndices: group.originalIndices,
                }
            }

            const { hwAccount, data } = validateAndExtract(group, account)

            const signed = await signTransactionsOnHardwareWallet(
                hwAccount,
                data.transactions,
                data.indicesToSign,
                {
                    registry: hardwareWalletRegistry,
                    encodeTransaction,
                    planner: plannerChainAdapters.get(chainId),
                    callbacks,
                },
            )

            // The multisig cosign transport posts these as
            // `responses[].signatures`. Without them, Ledger cosigns send
            // `signatures: [[]]` and the backend rejects the length mismatch.
            const signerInfo: SignerInfo = {
                address: account.address,
                signatures: signed.map(stx =>
                    stx.sig ? encodeToBase64(stx.sig) : null,
                ),
            }
            return {
                signedData: { type: 'transactions', signed },
                signers: [signerInfo],
                originalIndices: group.originalIndices,
            }
        },
    }
}
