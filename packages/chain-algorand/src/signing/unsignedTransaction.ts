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

import { Decimal } from 'decimal.js'
import type {
    ChainScope,
    ChainTransactionData,
    I18nKey,
    TransactionSummary,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { authorityOf, useAccountsStore } from '@perawallet/wallet-core-accounts'
import { encodeToBase64, type Optional } from '@perawallet/wallet-core-shared'
import type { MultisigParameters } from '@perawallet/wallet-core-multisig'
import { decodeTransaction } from '../blockchain/utils/transact'
import { algorandAddressOf } from '../accounts/vocabulary'
import { algorandDescriptor, isAlgorandNativeAssetId } from '../descriptor'
import {
    APP_CALL_TITLE_KEY,
    ASSET_CONFIG_TITLE_KEY,
    ASSET_FREEZE_TITLE_KEY,
    DEFAULT_TITLE_KEY,
    KEY_REGISTRATION_TITLE_KEY,
    OPT_IN_TITLE_KEY,
    OPT_OUT_TITLE_KEY,
    SEND_TITLE_KEY,
    assetRefOf,
} from '../transactions/summaryKeys'
import { generateMultisigAddress } from '../multisig/address'
import type { AlgorandTransactionPayload } from './planner'
import type { PeraTransaction } from '../blockchain/models/algosdk-shapes'

const chainSpecific = (
    titleKey: I18nKey,
    icon: TransactionSummary['icon'],
): TransactionSummary => ({
    kind: 'chain-specific',
    title: { key: titleKey },
    direction: 'none',
    icon,
})

const transferSummary = (
    transaction: PeraTransaction,
    receiver: string,
    assetId: string,
    amount: bigint,
): TransactionSummary => {
    const isSelf = receiver === transaction.sender.toString()
    return {
        kind: isAlgorandNativeAssetId(assetId) ? 'transfer' : 'token-transfer',
        title: { key: SEND_TITLE_KEY },
        direction: isSelf ? 'self' : 'out',
        icon: isSelf ? 'self' : 'send',
        counterparty: receiver,
        amount: {
            assetRef: assetRefOf(assetId),
            value: new Decimal(amount.toString()),
        },
    }
}

export const summarizeAlgorandTransaction = (
    transaction: PeraTransaction,
): TransactionSummary => {
    const { payment, assetTransfer } = transaction
    switch (transaction.type) {
        case 'pay': {
            return payment
                ? transferSummary(
                      transaction,
                      payment.receiver.toString(),
                      algorandDescriptor.nativeAsset.ref.assetId,
                      payment.amount,
                  )
                : chainSpecific(DEFAULT_TITLE_KEY, 'unknown')
        }
        case 'axfer': {
            if (!assetTransfer) {
                return chainSpecific(DEFAULT_TITLE_KEY, 'unknown')
            }
            const receiver = assetTransfer.receiver.toString()
            if (assetTransfer.closeRemainderTo) {
                return chainSpecific(OPT_OUT_TITLE_KEY, 'opt-out')
            }
            if (
                assetTransfer.amount === 0n &&
                receiver === transaction.sender.toString()
            ) {
                return chainSpecific(OPT_IN_TITLE_KEY, 'opt-in')
            }
            return transferSummary(
                transaction,
                receiver,
                assetTransfer.assetIndex.toString(),
                assetTransfer.amount,
            )
        }
        case 'appl': {
            return {
                kind: 'contract-call',
                title: { key: APP_CALL_TITLE_KEY },
                direction: 'none',
                icon: 'contract-call',
            }
        }
        case 'keyreg': {
            return chainSpecific(KEY_REGISTRATION_TITLE_KEY, 'consensus')
        }
        case 'acfg': {
            return chainSpecific(ASSET_CONFIG_TITLE_KEY, 'asset-config')
        }
        case 'afrz': {
            return chainSpecific(ASSET_FREEZE_TITLE_KEY, 'asset-freeze')
        }
        default: {
            return chainSpecific(DEFAULT_TITLE_KEY, 'unknown')
        }
    }
}

const chainDataOf = (transaction: PeraTransaction): ChainTransactionData => {
    const closeRemainderTo =
        transaction.payment?.closeRemainderTo ??
        transaction.assetTransfer?.closeRemainderTo
    return {
        family: 'algorand',
        ...(transaction.group && {
            groupId: encodeToBase64(transaction.group),
        }),
        ...(transaction.rekeyTo && { rekeyTo: transaction.rekeyTo.toString() }),
        ...(closeRemainderTo && {
            closeRemainderTo: closeRemainderTo.toString(),
        }),
    }
}

// The review refuses a wallet sender whose payload names another signer than
// its recorded authority, and the planner stamps the signer it reads here.
const authorizerOf = (
    transaction: PeraTransaction,
    scope: ChainScope,
): Optional<string> => {
    const sender = transaction.sender.toString()
    const account = useAccountsStore
        .getState()
        .accounts.find(candidate => algorandAddressOf(candidate) === sender)
    const authority = account ? authorityOf(account, scope) : null
    return authority !== null && authority !== sender ? authority : undefined
}

export const toUnsignedAlgorandTransaction = (
    transaction: PeraTransaction,
    scope: ChainScope,
): UnsignedTransaction => {
    const authorizer = authorizerOf(transaction, scope)
    const payload: AlgorandTransactionPayload = {
        transaction,
        ...(authorizer !== undefined && { authorizer }),
    }
    return {
        scope,
        payload,
        summary: summarizeAlgorandTransaction(transaction),
        chainData: chainDataOf(transaction),
    }
}

export const toUnsignedAlgorandTransactions = (
    transactions: PeraTransaction[],
    scope: ChainScope,
): UnsignedTransaction[] =>
    transactions.map(transaction =>
        toUnsignedAlgorandTransaction(transaction, scope),
    )

// Only chain-algorand builds these payloads, so the record is the one
// `toUnsignedAlgorandTransaction` wrote; `readAlgorandTransaction` stays the
// check for payloads from anywhere else.
const payloadOf = (unsigned: UnsignedTransaction): AlgorandTransactionPayload =>
    unsigned.payload as AlgorandTransactionPayload

/** The transaction of a payload chain-algorand built itself, with no network check. */
export const algorandTransactionOf = (
    unsigned: UnsignedTransaction,
): PeraTransaction => payloadOf(unsigned).transaction

export const withAlgorandTransaction = (
    unsigned: UnsignedTransaction,
    transaction: PeraTransaction,
): UnsignedTransaction => {
    const payload = payloadOf(unsigned)
    if (payload.transaction === transaction) return unsigned
    return {
        scope: unsigned.scope,
        payload: { ...payload, transaction },
        summary: summarizeAlgorandTransaction(transaction),
        chainData: chainDataOf(transaction),
    }
}

/**
 * `multisig`, when given, is the joint account the transaction is signed for:
 * its participants sign, so a cosign is for one of them.
 */
export const decodeUnsignedAlgorandTransaction = (
    bytes: Uint8Array,
    scope: ChainScope,
    multisig?: MultisigParameters,
): UnsignedTransaction => {
    const unsigned = toUnsignedAlgorandTransaction(
        decodeTransaction(bytes),
        scope,
    )
    if (!multisig) return unsigned
    const payload = payloadOf(unsigned)
    const joint = generateMultisigAddress(
        multisig.version,
        multisig.threshold,
        multisig.addresses,
    )
    return {
        ...unsigned,
        payload: {
            ...payload,
            multisig,
            ...(joint !== payload.transaction.sender.toString() && {
                authorizer: joint,
            }),
        },
    }
}

/** `unsigned`, signed for by `authorizer` (an ARC-0001 `authAddr`) instead of its sender. */
export const withAlgorandAuthorizer = (
    unsigned: UnsignedTransaction,
    authorizer: string,
): UnsignedTransaction => ({
    ...unsigned,
    payload: { ...payloadOf(unsigned), authorizer },
})
