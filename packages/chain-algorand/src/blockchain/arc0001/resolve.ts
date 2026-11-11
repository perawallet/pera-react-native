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
    decodeSignedTransaction,
    decodeTransactions,
    encodeTransactionRaw,
} from '../utils/transact'
import {
    bytesEqual,
    decodeFromBase64,
    toError,
} from '@perawallet/wallet-core-shared'
import type { ZodError } from 'zod'

import type { DappResolveContext } from '@perawallet/wallet-core-signing'
import {
    encodeAlgorandAddress,
    isValidAlgorandAddress,
} from '../utils/addresses'

import { Arc0001Error } from './errors'
import { arc0001SignTxnRequestSchema } from './schema'
import {
    Arc0001ErrorCode,
    type Arc0001ResolveResult,
    type Arc0001ResolvedTransaction,
    type Arc0001SignTxnsRequest,
    type Arc0001SignerKind,
    type Arc0001WalletTransaction,
} from './types'
import type { PeraTransaction } from '../models/algosdk-shapes'

// Algorand's atomic-group max is 16; this cap allows many concatenated
// groups in one request. Matches pera-android's MAX_TRANSACTION_COUNT.
const DEFAULT_MAX_TRANSACTIONS = 1000

/**
 * Validates and resolves an ARC-0001 `signTxns` payload. Throws
 * {@link Arc0001Error} with the spec's numeric code on any violation.
 * Group-ID integrity and user-facing warnings live downstream in the
 * signing pipeline; this function only handles shape + signer resolution.
 */
export const resolveArc0001SignTxnRequest = (
    request: Arc0001SignTxnsRequest,
    context: DappResolveContext,
): Arc0001ResolveResult => {
    // Wire shape is untrusted (spec: "SHALL NOT rely on TypeScript typing").
    const parsed = arc0001SignTxnRequestSchema.safeParse(request.transactions)
    if (!parsed.success) {
        throw schemaErrorToArc0001(parsed.error)
    }
    const transactions = parsed.data

    if (transactions.length === 0) {
        throw new Arc0001Error(
            Arc0001ErrorCode.InvalidInput,
            'sign request must contain at least one transaction',
        )
    }

    const maxTx = context.maxTransactions ?? DEFAULT_MAX_TRANSACTIONS
    if (transactions.length > maxTx) {
        throw new Arc0001Error(
            Arc0001ErrorCode.TooManyTransactions,
            `sign request contains ${transactions.length} transactions; max is ${maxTx}`,
        )
    }

    // Full decoded array is required downstream — recomputing the group
    // hash over a filtered subset would never match the claimed group ID.
    const allDecoded: PeraTransaction[] = transactions.map((entry, index) => {
        let bytes: Uint8Array
        try {
            bytes = decodeFromBase64(entry.txn)
        } catch (e) {
            throw new Arc0001Error(
                Arc0001ErrorCode.InvalidInput,
                `transaction at index ${index} is not valid base64: ${toError(e).message}`,
                { index, field: 'txn' },
            )
        }
        try {
            return decodeTransactions([bytes])[0] as PeraTransaction
        } catch (e) {
            // algosdk v3 validates on decode and rejects malformed input that
            // algokit-utils v10 tolerated — notably a zero-address `rekeyTo`
            // (canonical encoders omit an empty rekey). This strict rejection
            // is deliberate: algosdk is the canonical source of truth for
            // transaction validity. Transports log the relayed
            // rejection, so real-dApp impact stays observable.
            const reason = toError(e).message
            throw new Arc0001Error(
                Arc0001ErrorCode.InvalidInput,
                `could not decode transaction at index ${index}: ${reason}`,
                { index, field: 'txn' },
            )
        }
    })

    const toSign: Arc0001ResolvedTransaction[] = []
    const signerOverrides = new Map<number, string>()
    const passthrough = new Map<number, string>()
    let requestedCount = 0
    const heldAddresses = context.heldAddresses ?? context.signableAddresses

    for (let i = 0; i < transactions.length; i++) {
        const entry = transactions[i]
        const decoded = allDecoded[i]
        const sender = encodeAlgorandAddress(decoded.sender.publicKey)
        const entrySigner = resolveEntrySigner(entry, sender, i)

        if (entrySigner.kind === 'do-not-sign') {
            if (entry.stxn !== undefined) {
                passthrough.set(i, verifiedStxn(entry.stxn, decoded, i))
            }
            continue
        }
        requestedCount++

        // Multisig sender short-circuits the `signers` hint — sign with
        // the multisig address itself so the transport selector picks the
        // propose branch and collects participant signatures via the
        // backend.
        const isMultisigSender = context.multisigAddresses?.has(sender) ?? false
        const resolvedSigner: Arc0001SignerKind = isMultisigSender
            ? { kind: 'single', address: sender }
            : entrySigner

        const candidate = resolvedSigner.address
        const isNamed =
            !isMultisigSender &&
            (entry.authAddr !== undefined || entry.signers !== undefined)
        // An `authAddr` signs with its own key, so being held is enough: its
        // own rekey doesn't apply.
        const signsWithOwnKey = isNamed && entry.authAddr !== undefined
        const canSign = signsWithOwnKey
            ? heldAddresses.has(candidate)
            : context.signableAddresses.has(candidate)
        const isAuthorized =
            context.authorizedAddresses === undefined ||
            context.authorizedAddresses.has(candidate)

        // ARC-0001: `signers: [sender]` asks for the sender's own key, so a
        // rekeyed sender without `authAddr` is rejected rather than signed
        // through its rekey. Only for authorized senders, so the answer
        // reveals nothing about the wallet's other accounts.
        if (
            isNamed &&
            !signsWithOwnKey &&
            isAuthorized &&
            context.delegatedAddresses?.has(candidate)
        ) {
            throw new Arc0001Error(
                Arc0001ErrorCode.InvalidInput,
                `signers[0] is rekeyed and needs authAddr (entry index ${i})`,
                { index: i, field: 'signers' },
            )
        }

        if (!canSign || !isAuthorized) {
            // ARC-0025 fails the whole request when a requested signature
            // can't be given. One message for every case: naming the address,
            // or answering a held-but-unauthorized one differently, would let
            // a dApp enumerate the wallet's other accounts over the bridge.
            if (isNamed) {
                throw new Arc0001Error(
                    Arc0001ErrorCode.Unauthorized,
                    'the wallet cannot sign every requested transaction',
                )
            }
            // Deliberately lenient where ARC-0001 fails the request:
            // @perawallet/connect 1.5.2 and older drop `signers: []`, so a
            // dApp's "don't sign" transactions arrive with no `signers`.
            continue
        }

        const toSignIndex = toSign.length
        toSign.push({
            index: i,
            walletTxn: entry,
            decoded,
            sender,
            signer: resolvedSigner,
        })
        if (signsWithOwnKey) {
            signerOverrides.set(toSignIndex, candidate)
        }
    }

    // A request that asked for at least one signature but yielded nothing
    // signable (watch-only signer, account rekeyed to an external key,
    // unknown address) gets an error — an all-null "success" gives the
    // dApp nothing to act on. Groups that are explicitly all-`signers: []`
    // keep the spec's all-null response.
    if (requestedCount > 0 && toSign.length === 0) {
        throw new Arc0001Error(
            Arc0001ErrorCode.Unauthorized,
            'the wallet cannot sign any of the requested transactions',
        )
    }

    return { allDecoded, toSign, signerOverrides, passthrough }
}

// ARC-0001: an `stxn` is returned as is, but only for exactly the `txn` it
// claims to sign; its signature is the dApp's business.
const verifiedStxn = (
    stxn: string,
    decoded: PeraTransaction,
    index: number,
): string => {
    let signedTxn: ReturnType<typeof decodeSignedTransaction>
    try {
        signedTxn = decodeSignedTransaction(decodeFromBase64(stxn))
    } catch {
        throw new Arc0001Error(
            Arc0001ErrorCode.InvalidInput,
            `stxn at index ${index} is not a signed transaction`,
            { index, field: 'stxn' },
        )
    }
    if (
        !bytesEqual(
            encodeTransactionRaw(signedTxn.txn),
            encodeTransactionRaw(decoded),
        )
    ) {
        throw new Arc0001Error(
            Arc0001ErrorCode.InvalidInput,
            `stxn at index ${index} signs a different transaction than txn`,
            { index, field: 'stxn' },
        )
    }
    return stxn
}

// ARC-0001 errors carry a single { code, message, data } — collapse zod's
// issue list to the first violation with its path projected into data.
const schemaErrorToArc0001 = (error: ZodError): Arc0001Error => {
    const issue = error.issues[0]
    const path = issue.path
    const firstSegment = path[0]
    const index = typeof firstSegment === 'number' ? firstSegment : undefined
    const fieldSegments = (index === undefined ? path : path.slice(1)).map(
        String,
    )

    if (
        issue.code === 'unrecognized_keys' &&
        Array.isArray((issue as { keys?: unknown }).keys)
    ) {
        const keys = (issue as { keys: string[] }).keys
        return new Arc0001Error(
            Arc0001ErrorCode.InvalidInput,
            `invalid sign request — unknown field(s) at index ${index ?? '(root)'}: ${keys.join(', ')}`,
            { index, field: keys[0] },
        )
    }

    const fieldPath = fieldSegments.join('.') || undefined
    return new Arc0001Error(
        Arc0001ErrorCode.InvalidInput,
        `invalid sign request — ${path.map(String).join('.') || '(root)'}: ${issue.message}`,
        { index, field: fieldPath },
    )
}

const resolveEntrySigner = (
    entry: Arc0001WalletTransaction,
    sender: string,
    index: number,
): Arc0001SignerKind => {
    if (
        entry.authAddr !== undefined &&
        !isValidAlgorandAddress(entry.authAddr)
    ) {
        throw new Arc0001Error(
            Arc0001ErrorCode.InvalidInput,
            `invalid authAddr at transaction index ${index}`,
            { index, field: 'authAddr' },
        )
    }
    if (entry.signers) {
        for (const s of entry.signers) {
            if (!isValidAlgorandAddress(s)) {
                throw new Arc0001Error(
                    Arc0001ErrorCode.InvalidInput,
                    `invalid signer address at transaction index ${index}`,
                    { index, field: 'signers' },
                )
            }
        }
    }
    if (entry.msig) {
        throw new Arc0001Error(
            Arc0001ErrorCode.Unsupported,
            `multisig signing is not supported (entry index ${index})`,
            { index, field: 'msig' },
        )
    }

    if (entry.signers && entry.signers.length === 0) {
        return { kind: 'do-not-sign' }
    }

    if (entry.stxn !== undefined) {
        throw new Arc0001Error(
            Arc0001ErrorCode.InvalidInput,
            `stxn is only allowed with signers: [] (entry index ${index})`,
            { index, field: 'stxn' },
        )
    }

    // `msig` was refused above, and more than one signer needs it.
    if (entry.signers && entry.signers.length > 1) {
        throw new Arc0001Error(
            Arc0001ErrorCode.InvalidInput,
            `more than one signer needs msig (entry index ${index})`,
            { index, field: 'signers' },
        )
    }

    if (entry.signers && entry.signers.length === 1) {
        const requested = entry.signers[0]
        if (entry.authAddr !== undefined && requested !== entry.authAddr) {
            throw new Arc0001Error(
                Arc0001ErrorCode.InvalidInput,
                `signers[0] (${requested}) disagrees with authAddr (${entry.authAddr}) at index ${index}`,
                { index, field: 'signers' },
            )
        }
        if (entry.authAddr === undefined && requested !== sender) {
            throw new Arc0001Error(
                Arc0001ErrorCode.InvalidInput,
                `signers[0] (${requested}) is not the sender and authAddr is missing at index ${index}`,
                { index, field: 'signers' },
            )
        }
        return { kind: 'single', address: requested }
    }

    return { kind: 'single', address: entry.authAddr ?? sender }
}
