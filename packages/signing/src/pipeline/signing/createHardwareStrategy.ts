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

import {
    chainAccountOf,
    hasCustody,
    type HardwareWalletAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    HardwareWalletRegistry,
    HardwareWalletTransport,
} from '@perawallet/wallet-core-hardware-wallet'

import {
    encodeToBase64,
    withTimeout,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type {
    SigningStrategy,
    AnalyzedSignableGroup,
    ChainSignerTransactions,
    AuthData,
    AuthDataMetadata,
    SigningResult,
    SigningCallbacks,
    SignerInfo,
} from '../types'
import { CannotSignError, HardwareWalletError, SigningError } from '../errors'
import {
    LEDGER_CONNECTION_TIMEOUT_MS,
    LEDGER_CONFIRMATION_TIMEOUT_MS,
} from '@perawallet/wallet-core-ledger'
import type {
    ChainId,
    SignedTransaction,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import {
    plannerChainAdapters,
    type PlannerChainAdapter,
} from '../../chain-adapter'
import { authDataSignerFor, type AuthDataSigner } from '../../message-signer'
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
export type EncodeTransactionFunction = (
    transaction: UnsignedTransaction,
) => Uint8Array

/** `signatures` is index-aligned with `signed`: what the device returned, or `null` for a slot it didn't sign. */
type HardwareSignedTransactions = {
    signed: SignedTransaction[]
    signatures: Nullable<Uint8Array>[]
}

export type HardwareStrategyOptions = {
    hardwareWalletRegistry?: HardwareWalletRegistry
    encodeTransaction: EncodeTransactionFunction
    /** Read at auth-data sign time, for the signer / rekey cross-check. */
    getAllAccounts: () => WalletAccount[]
    /** The chain the device signs for; the account's address there is the one verified. */
    chainId: ChainId
}

/** A hardware account and the address it signs for on the request's chain. */
type HardwareSigner = {
    account: HardwareWalletAccount
    address: string
}

const toHardwareSigner = (
    account: WalletAccount,
    chainId: ChainId,
): HardwareSigner => {
    const address = chainAccountOf(account, chainId)?.address
    if (!hasCustody(account, 'hardware')) {
        throw new CannotSignError(
            address ?? '',
            'Account is not a hardware wallet',
        )
    }
    if (!address) {
        throw new CannotSignError('', `Account has no address on ${chainId}`)
    }
    return { account, address }
}

/**
 * Validate preconditions and extract hardware account details.
 */
const validateAndExtract = (
    group: AnalyzedSignableGroup,
    chainId: ChainId,
): ChainSignerTransactions => {
    if (group.data.type === 'arbitrary-data') {
        throw new SigningError(
            'Hardware wallet signing of arbitrary data is not supported',
            undefined,
            // Retrying can never succeed — suppress the Retry affordance.
            { retryable: false },
        )
    }

    if (group.data.type !== 'transactions') {
        throw new HardwareWalletError('unsupported_data_type')
    }

    // Only a chain's planner adapter reads its transactions out of a payload.
    if (!plannerChainAdapters.has(chainId)) {
        throw new HardwareWalletError('unsupported_data_type')
    }
    return plannerChainAdapters.get(chainId).readTransactionsData(group.data)
}

/**
 * Sign each transaction sequentially on the hardware device.
 */
const signTransactions = async (
    transport: HardwareWalletTransport,
    data: ChainSignerTransactions,
    signer: HardwareSigner,
    encodeTransaction: EncodeTransactionFunction,
    planner: PlannerChainAdapter,
    guard: DisconnectGuard,
    callbacks?: SigningCallbacks,
): Promise<HardwareSignedTransactions> => {
    const { transactions, indicesToSign } = data
    const { accountIndex } = signer.account.custody

    callbacks?.onSigningStart?.()
    const signed: SignedTransaction[] = []
    const signatures: Nullable<Uint8Array>[] = []

    for (let index = 0; index < transactions.length; index++) {
        // No APDU leaves the app after an abort — without this check the
        // detached loop would keep prompting the device for every remaining
        // transaction while the app already shows an error sheet.
        throwIfAborted(callbacks?.signal)

        const txn = transactions[index]

        if (!indicesToSign.includes(index)) {
            signed.push(planner.assembleSignedTransaction(txn))
            signatures.push(null)
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
                signerAddress: signer.address,
            }),
        )
        signatures.push(signature)
    }

    callbacks?.onSigningComplete?.()
    return { signed, signatures }
}

type SignTransactionsOnHardwareWalletOptions = LedgerSessionOptions & {
    encodeTransaction: EncodeTransactionFunction
    planner: PlannerChainAdapter
}

type SignAuthDataOnHardwareWalletOptions = LedgerSessionOptions & {
    authDataSigner: AuthDataSigner
    getAllAccounts: () => WalletAccount[]
}

/**
 * Signs sequentially, returning a parallel array where everything outside
 * `indicesToSign` is an unsigned envelope.
 */
const signTransactionsOnHardwareWallet = (
    signer: HardwareSigner,
    transactions: UnsignedTransaction[],
    indicesToSign: number[],
    options: SignTransactionsOnHardwareWalletOptions,
): Promise<HardwareSignedTransactions> => {
    const { encodeTransaction, planner, callbacks } = options

    return withLedgerSession(
        signer.account,
        signer.address,
        options,
        ({ transport, guard }) =>
            signTransactions(
                transport,
                { transactions, indicesToSign },
                signer,
                encodeTransaction,
                planner,
                guard,
                callbacks,
            ),
    )
}

/** Gates on minimum app version and host-side validation before signing. */
const signAuthDataOnHardwareWallet = (
    signer: HardwareSigner,
    authData: AuthData,
    metadata: AuthDataMetadata,
    options: SignAuthDataOnHardwareWalletOptions,
): Promise<Uint8Array> => {
    const { authDataSigner, getAllAccounts, callbacks } = options
    const { accountIndex } = signer.account.custody

    return withLedgerSession(
        signer.account,
        signer.address,
        options,
        async ({ transport, guard }) => {
            // Early version gate — the device-side error is the fallback.
            await withTimeout(
                transport.assertCanSignData(),
                LEDGER_CONNECTION_TIMEOUT_MS,
                'Read Ledger app version',
                ledgerTimeoutReason('Read Ledger app version'),
            )

            authDataSigner.validateAuthData(
                authData,
                metadata,
                getAllAccounts(),
            )

            callbacks?.onSigningStart?.()
            callbacks?.onProgress?.(1, 1)

            const signature = await withTimeout(
                guard.race(
                    transport.signData({
                        accountIndex,
                        data: authData.data,
                        signerPublicKey: authDataSigner.signerPublicKey(
                            signer.address,
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
            return hasCustody(account, 'hardware')
        },

        sign: async (
            group: AnalyzedSignableGroup,
            account: WalletAccount,
            callbacks?: SigningCallbacks,
        ): Promise<SigningResult> => {
            const signer = toHardwareSigner(account, chainId)

            if (group.data.type === 'auth-data') {
                // Resolved before any Ledger session so a chain with no
                // auth-data signer is refused without a device prompt.
                const authDataSigner = authDataSignerFor(
                    chainId,
                    signer.address,
                )
                const signature = await signAuthDataOnHardwareWallet(
                    signer,
                    group.data.authData,
                    group.data.metadata,
                    {
                        registry: hardwareWalletRegistry,
                        chainId,
                        authDataSigner,
                        getAllAccounts,
                        callbacks,
                    },
                )
                return {
                    signedData: { type: 'auth-data', signature },
                    signers: [{ address: signer.address }],
                    originalIndices: group.originalIndices,
                }
            }

            const data = validateAndExtract(group, chainId)

            const { signed, signatures } =
                await signTransactionsOnHardwareWallet(
                    signer,
                    data.transactions,
                    data.indicesToSign,
                    {
                        registry: hardwareWalletRegistry,
                        chainId,
                        encodeTransaction,
                        planner: plannerChainAdapters.get(chainId),
                        callbacks,
                    },
                )

            // The multisig cosign transport posts these as
            // `responses[].signatures`. Without them, Ledger cosigns send
            // `signatures: [[]]` and the backend rejects the length mismatch.
            const signerInfo: SignerInfo = {
                address: signer.address,
                signatures: signatures.map(sig =>
                    sig ? encodeToBase64(sig) : null,
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
