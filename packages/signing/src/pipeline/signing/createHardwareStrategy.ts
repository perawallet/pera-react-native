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
    HardwareWalletTransport,
    HardwareWalletRegistry,
    HardwareWalletTransportProvider,
} from '@perawallet/wallet-core-hardware-wallet'
import type {
    PeraTransaction,
    PeraSignedTransaction,
} from '@perawallet/wallet-core-blockchain'
import { Address } from '@perawallet/wallet-core-blockchain'
import { SignedTransaction } from 'algosdk'
import {
    encodeToBase64,
    withTimeout,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type {
    SigningStrategy,
    AnalyzedSignableGroup,
    TransactionSignableData,
    Arc60StdSigData,
    Arc60Metadata,
    SigningResult,
    SigningCallbacks,
    SignerInfo,
} from '../types'
import {
    CannotSignError,
    HardwareSigningAbortedError,
    HardwareWalletError,
    SigningError,
} from '../errors'
import {
    LedgerAppOutdatedError,
    LedgerConnectionError,
    LedgerAddressMismatchError,
    LEDGER_CONNECTION_TIMEOUT_MS,
    LEDGER_CONFIRMATION_TIMEOUT_MS,
    MIN_ARBITRARY_SIGN_APP_VERSION,
    isAppVersionAtLeast,
} from '@perawallet/wallet-core-ledger'
import { validateArc60AuthRequest } from '../../utils/arc60'
import { isLedgerError } from '../../utils/classifyLedgerErrorKind'

/**
 * Factory for the `rejectWith` callback of the shared `withTimeout` helper,
 * so Ledger call sites reject with a typed `LedgerConnectionError` rather
 * than the generic `Error` the shared utility would otherwise produce.
 */
const ledgerTimeoutReason =
    (operation: string) =>
    (_op: string, ms: number): Error =>
        new LedgerConnectionError(`${operation} timed out after ${ms}ms`)

/**
 * Function to encode a transaction to raw bytes for the Ledger to sign.
 * Injected from the hook layer (useTransactionEncoder).
 */
export type EncodeTransactionFunction = (tx: PeraTransaction) => Uint8Array

const throwIfAborted = (signal: Optional<AbortSignal>): void => {
    if (signal?.aborted) throw new HardwareSigningAbortedError()
}

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
): {
    hwAccount: HardwareWalletAccount
    data: TransactionSignableData
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

    if (group.data.type !== 'transactions') {
        throw new HardwareWalletError('unsupported_data_type')
    }

    return { hwAccount: account as HardwareWalletAccount, data: group.data }
}

/**
 * Connect to the hardware device and verify it is ready.
 *
 * If `connect` rejects via the timeout race, a late-arriving transport is
 * disconnected as soon as it resolves so we don't leak an open BLE link
 * (Android in particular won't reap an orphaned link until the OS times it
 * out, which can block the next reconnect attempt).
 *
 * Threat-model note on the address re-fetch: this matches native iOS by
 * verifying the on-device address at connect time. It does NOT re-verify
 * before each subsequent transaction — for multi-tx sessions the device is
 * trusted to remain on the same account between signs. Tightening this to a
 * per-tx check is a future hardening.
 */
const connectAndVerify = async (
    transportProvider: HardwareWalletTransportProvider,
    deviceId: string,
    accountIndex: number,
    expectedAddress: string,
    callbacks?: SigningCallbacks,
): Promise<HardwareWalletTransport> => {
    callbacks?.onPhaseChange?.('connecting')
    const connectPromise = transportProvider.connect(deviceId)
    let transport: HardwareWalletTransport
    try {
        transport = await withTimeout(
            connectPromise,
            LEDGER_CONNECTION_TIMEOUT_MS,
            'Connect to Ledger',
            ledgerTimeoutReason('Connect to Ledger'),
        )
    } catch (error) {
        connectPromise
            .then(t => t.disconnect().catch(() => undefined))
            .catch(() => undefined)
        throw error
    }

    // Re-fetch the address at the stored index and compare to the account's
    // expected address. Catches silent drift when the on-device account order
    // has changed since import.
    try {
        const fetchedAccount = await withTimeout(
            transport.getAddress(accountIndex, false),
            LEDGER_CONNECTION_TIMEOUT_MS,
            'Verify Ledger address',
            ledgerTimeoutReason('Verify Ledger address'),
        )
        if (fetchedAccount.address !== expectedAddress) {
            throw new LedgerAddressMismatchError(
                expectedAddress,
                fetchedAccount.address,
            )
        }
    } catch (error) {
        // Disconnect the (successfully connected) transport before surfacing
        // the verification error — otherwise the outer finally won't see a
        // transport handle and the BLE link leaks.
        await transport.disconnect().catch(() => undefined)
        throw error
    }

    callbacks?.onPhaseChange?.('awaiting-approval')
    return transport
}

/**
 * Sign each transaction sequentially on the hardware device.
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
        // No APDU leaves the app after an abort — without this check the
        // detached loop would keep prompting the device for every remaining
        // transaction while the app already shows an error sheet.
        throwIfAborted(callbacks?.signal)

        const txn = transactions[index]

        if (!indicesToSign.includes(index)) {
            signed.push(new SignedTransaction({ txn }))
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
            transport.signTransaction(accountIndex, txnBytes),
            LEDGER_CONFIRMATION_TIMEOUT_MS,
            'Sign Ledger transaction',
            ledgerTimeoutReason('Sign Ledger transaction'),
        )

        const senderAddress = txn.sender.toString()
        const authAddress =
            hwAccount.address !== senderAddress
                ? Address.fromString(hwAccount.address)
                : undefined

        signed.push(
            new SignedTransaction({
                txn,
                sig: signature,
                sgnr: authAddress,
            }),
        )
    }

    callbacks?.onSigningComplete?.()
    return signed
}

/**
 * Classify a raw error into a typed error that the UI presets understand.
 * Returns the classified value rather than throwing, so the caller can pass
 * the same value to both `onError` and `throw`.
 */
const toClassifiedError = (error: unknown): Error => {
    if (
        error instanceof CannotSignError ||
        error instanceof HardwareSigningAbortedError ||
        error instanceof HardwareWalletError ||
        isLedgerError(error)
    ) {
        return error as Error
    }
    return new SigningError(
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined,
    )
}

type SignTransactionsOnHardwareWalletOptions = {
    registry?: HardwareWalletRegistry
    encodeTransaction: EncodeTransactionFunction
    callbacks?: SigningCallbacks
}

type SignArc60OnHardwareWalletOptions = Omit<
    SignTransactionsOnHardwareWalletOptions,
    'encodeTransaction'
>

/**
 * Connect to the hardware device, verify the on-device address matches the
 * account's expected address, sign the given transactions sequentially, then
 * disconnect. Returns a parallel array where indices listed in `indicesToSign`
 * are signed and all other entries are unsigned placeholders (`{ txn }` only).
 *
 * Used by the XState-based signing pipeline's hardware strategy. Local-key
 * accounts sign through `useLocalKeyTransactionSigner` and never reach here.
 */
const signTransactionsOnHardwareWallet = async (
    hwAccount: HardwareWalletAccount,
    transactions: PeraTransaction[],
    indicesToSign: number[],
    options: SignTransactionsOnHardwareWalletOptions,
): Promise<PeraSignedTransaction[]> => {
    const { registry, encodeTransaction, callbacks } = options

    const transportProvider = registry?.getProvider(
        hwAccount.hardwareDetails.manufacturer,
        hwAccount.hardwareDetails.transportType,
    )
    if (!transportProvider) {
        throw new HardwareWalletError('transport_unavailable')
    }

    const { deviceId, accountIndex } = hwAccount.hardwareDetails
    let transport: Optional<HardwareWalletTransport>
    const signal = callbacks?.signal
    // Disconnecting settles the in-flight APDU exchange (the BLE library
    // races it against disconnect), which dismisses the on-device prompt and
    // evicts the cached transport so an immediate retry gets a fresh
    // connection instead of a TransportRaceCondition.
    const abortDisconnect = () => {
        transport?.disconnect().catch(() => undefined)
    }
    signal?.addEventListener('abort', abortDisconnect)

    try {
        throwIfAborted(signal)
        transport = await connectAndVerify(
            transportProvider,
            deviceId,
            accountIndex,
            hwAccount.address,
            callbacks,
        )
        throwIfAborted(signal)

        return await signTransactions(
            transport,
            { type: 'transactions', transactions, indicesToSign },
            hwAccount,
            encodeTransaction,
            callbacks,
        )
    } catch (error) {
        const classified = toClassifiedError(error)
        callbacks?.onError?.(classified)
        throw classified
    } finally {
        signal?.removeEventListener('abort', abortDisconnect)
        try {
            await transport?.disconnect()
        } catch {
            // Swallow disconnect errors to preserve original error
        }
    }
}

/**
 * Connect to the hardware device, verify address, gate on minimum app version,
 * run host-side ARC-60 validation, then forward the sign request to the device.
 * Returns the raw Ed25519 signature bytes.
 */
const signArc60OnHardwareWallet = async (
    hwAccount: HardwareWalletAccount,
    stdSigData: Arc60StdSigData,
    metadata: Arc60Metadata,
    options: SignArc60OnHardwareWalletOptions,
): Promise<Uint8Array> => {
    const { registry, callbacks } = options

    const transportProvider = registry?.getProvider(
        hwAccount.hardwareDetails.manufacturer,
        hwAccount.hardwareDetails.transportType,
    )
    if (!transportProvider) {
        throw new HardwareWalletError('transport_unavailable')
    }

    const { deviceId, accountIndex } = hwAccount.hardwareDetails
    let transport: Optional<HardwareWalletTransport>
    const signal = callbacks?.signal
    // Same abort → disconnect wiring as the transaction path: settle the
    // in-flight exchange so the device prompt is dismissed and the cached
    // transport is evicted for a clean retry.
    const abortDisconnect = () => {
        transport?.disconnect().catch(() => undefined)
    }
    signal?.addEventListener('abort', abortDisconnect)

    try {
        throwIfAborted(signal)
        transport = await connectAndVerify(
            transportProvider,
            deviceId,
            accountIndex,
            hwAccount.address,
            callbacks,
        )
        throwIfAborted(signal)

        // Early version gate — the device-side error is the fallback.
        const version = await withTimeout(
            transport.getAppVersion(),
            LEDGER_CONNECTION_TIMEOUT_MS,
            'Read Ledger app version',
            ledgerTimeoutReason('Read Ledger app version'),
        )
        if (!isAppVersionAtLeast(version, MIN_ARBITRARY_SIGN_APP_VERSION)) {
            throw new LedgerAppOutdatedError()
        }

        // Shared host-side validation (scope / domain / SIWA / signer).
        validateArc60AuthRequest(stdSigData, metadata)

        callbacks?.onSigningStart?.()
        callbacks?.onProgress?.(1, 1)

        const signature = await withTimeout(
            transport.signData({
                accountIndex,
                data: stdSigData.data,
                signerPublicKey: Address.fromString(hwAccount.address)
                    .publicKey,
                domain: stdSigData.domain,
                authenticatorData: stdSigData.authenticatorData,
                requestId: stdSigData.requestId,
                scope: metadata.scope,
                encoding: metadata.encoding,
            }),
            LEDGER_CONFIRMATION_TIMEOUT_MS,
            'Sign Ledger data',
            ledgerTimeoutReason('Sign Ledger data'),
        )

        callbacks?.onSigningComplete?.()
        return signature
    } catch (error) {
        const classified = toClassifiedError(error)
        callbacks?.onError?.(classified)
        throw classified
    } finally {
        signal?.removeEventListener('abort', abortDisconnect)
        try {
            await transport?.disconnect()
        } catch {
            // Swallow disconnect errors to preserve original error
        }
    }
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
            if (!isHardwareWalletAccount(account)) {
                throw new CannotSignError(
                    account.address,
                    'Account is not a hardware wallet',
                )
            }

            if (group.data.type === 'arc60') {
                const signature = await signArc60OnHardwareWallet(
                    account,
                    group.data.stdSigData,
                    group.data.metadata,
                    {
                        registry: hardwareWalletRegistry,
                        callbacks,
                    },
                )
                return {
                    signedData: { type: 'arc60', signature },
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
                    callbacks,
                },
            )

            // Surface per-transaction base64 signatures on the signer so the
            // multisig cosign transport can post them to the backend's
            // `responses[].signatures` (mirrors createLocalKeyStrategy and
            // createMultisigStrategy.extractSignatures). Without this, Ledger
            // cosigns produce request bodies with `signatures: [[]]` and the
            // backend rejects them with "Lengths of transaction list and
            // signature list should be equal."
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
