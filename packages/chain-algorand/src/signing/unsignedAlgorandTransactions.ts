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
import {
    authorityOf,
    multisigParametersOf,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { MultisigParameters } from '@perawallet/wallet-core-multisig'
import {
    type ChainScope,
    i18nKey,
    type I18nKey,
    type PeraTransaction,
    type TransactionSummary,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { algorandAddressOf } from '../accounts/vocabulary'
import { decodeTransaction } from '../blockchain'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandDescriptor } from '../descriptor'
import type { AlgorandTransactionPayload } from './planner'

const SEND = i18nKey('transactions.list_item.send')
const OPT_IN = i18nKey('transactions.list_item.opt_in')
const OPT_OUT = i18nKey('transactions.list_item.opt_out')
const ASSET_CONFIG = i18nKey('transactions.list_item.asset_config')
const ASSET_FREEZE = i18nKey('transactions.list_item.asset_freeze')
const APP_CALL = i18nKey('transactions.list_item.app_call')
const KEY_REGISTRATION = i18nKey('transactions.list_item.key_registration')
const DEFAULT = i18nKey('transactions.list_item.default')

const otherParty = (
    key: I18nKey,
    kind: TransactionSummary['kind'],
    icon: TransactionSummary['icon'],
): TransactionSummary => ({
    kind,
    title: { key },
    direction: 'none',
    icon,
})

const transferSummary = (
    sender: string,
    receiver: string,
    assetId: string,
    amount: bigint,
): TransactionSummary => {
    const isSelf = sender === receiver
    return {
        kind:
            assetId === algorandDescriptor.nativeAsset.ref.assetId
                ? 'transfer'
                : 'token-transfer',
        title: { key: SEND },
        direction: isSelf ? 'self' : 'out',
        icon: isSelf ? 'self' : 'send',
        counterparty: receiver,
        amount: {
            assetRef: { chainId: ALGORAND_CHAIN_ID, assetId },
            value: new Decimal(amount.toString()),
        },
    }
}

/** What a transaction does, from its own fields; builders that know more pass their own. */
export const summarizeAlgorandTransaction = (
    transaction: PeraTransaction,
): TransactionSummary => {
    const sender = transaction.sender.toString()
    const { payment, assetTransfer } = transaction
    if (payment) {
        return transferSummary(
            sender,
            payment.receiver.toString(),
            algorandDescriptor.nativeAsset.ref.assetId,
            payment.amount,
        )
    }
    if (assetTransfer) {
        const receiver = assetTransfer.receiver.toString()
        if (assetTransfer.closeRemainderTo) {
            return otherParty(OPT_OUT, 'chain-specific', 'opt-out')
        }
        if (assetTransfer.amount === 0n && receiver === sender) {
            return otherParty(OPT_IN, 'chain-specific', 'opt-in')
        }
        return transferSummary(
            sender,
            receiver,
            assetTransfer.assetIndex.toString(),
            assetTransfer.amount,
        )
    }
    if (transaction.applicationCall) {
        return otherParty(APP_CALL, 'contract-call', 'contract-call')
    }
    if (transaction.keyreg) {
        return otherParty(KEY_REGISTRATION, 'chain-specific', 'consensus')
    }
    if (transaction.assetConfig) {
        return otherParty(ASSET_CONFIG, 'chain-specific', 'asset-config')
    }
    if (transaction.assetFreeze) {
        return otherParty(ASSET_FREEZE, 'chain-specific', 'asset-freeze')
    }
    return otherParty(DEFAULT, 'chain-specific', 'unknown')
}

const chainDataOf = (
    transaction: PeraTransaction,
): Extract<UnsignedTransaction['chainData'], { family: 'algorand' }> => {
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

// The planner signs as `authorizer ?? sender`, so a rekeyed sender without its
// authorizer would be signed with the wrong key and only fail at algod.
const signingPayloadFor = (
    transaction: PeraTransaction,
    scope: ChainScope,
    accounts: WalletAccount[],
): AlgorandTransactionPayload => {
    const sender = transaction.sender.toString()
    const accountFor = (address: string) =>
        accounts.find(account => algorandAddressOf(account) === address)
    const senderAccount = accountFor(sender)
    const authorizer = senderAccount
        ? (authorityOf(senderAccount, scope) ?? undefined)
        : undefined
    const signerAccount = accountFor(authorizer ?? sender)
    const multisig = signerAccount
        ? multisigParametersOf(signerAccount, ALGORAND_CHAIN_ID)
        : undefined
    return {
        transaction,
        ...(authorizer && { authorizer }),
        ...(multisig && { multisig }),
    }
}

export type AlgorandWrapContext = {
    scope: ChainScope
    accounts: WalletAccount[]
}

export const toAlgorandUnsignedTransaction = (
    transaction: PeraTransaction,
    { scope, accounts }: AlgorandWrapContext,
    summary: TransactionSummary = summarizeAlgorandTransaction(transaction),
): UnsignedTransaction => ({
    scope,
    payload: signingPayloadFor(transaction, scope, accounts),
    summary,
    chainData: chainDataOf(transaction),
})

export const toAlgorandUnsignedTransactions = (
    transactions: PeraTransaction[],
    context: AlgorandWrapContext,
): UnsignedTransaction[] =>
    transactions.map(transaction =>
        toAlgorandUnsignedTransaction(transaction, context),
    )

const currentContext = (scope: ChainScope): AlgorandWrapContext => ({
    scope,
    accounts: useAccountsStore.getState().accounts,
})

/** A builder whose group comes back wrapped, signed by today's accounts. */
export const wrapsAlgorandGroup =
    <P extends { scope: ChainScope }>(
        build: (params: P) => Promise<PeraTransaction[]>,
    ) =>
    async (params: P): Promise<UnsignedTransaction[]> =>
        toAlgorandUnsignedTransactions(
            await build(params),
            currentContext(params.scope),
        )

export const wrapsAlgorandTransaction =
    <P extends { scope: ChainScope }>(
        build: (params: P) => Promise<PeraTransaction>,
    ) =>
    async (params: P): Promise<UnsignedTransaction> =>
        toAlgorandUnsignedTransaction(
            await build(params),
            currentContext(params.scope),
        )

/** Wire bytes (no `TX` prefix) of an Algorand transaction, ready to sign. */
export const decodeAlgorandUnsignedTransaction = (
    bytes: Uint8Array,
    context: AlgorandWrapContext,
): UnsignedTransaction =>
    toAlgorandUnsignedTransaction(
        decodeTransaction(bytes) as PeraTransaction,
        context,
    )

/**
 * A joint account's transaction, from wire bytes. Its participants sign; a
 * sender rekeyed to the joint account names it as the authorizer.
 */
export const decodeAlgorandMultisigTransaction = (
    bytes: Uint8Array,
    joint: { address: string; parameters: MultisigParameters },
    scope: ChainScope,
): UnsignedTransaction => {
    const transaction = decodeTransaction(bytes) as PeraTransaction
    const isJointSender = transaction.sender.toString() === joint.address
    return {
        scope,
        payload: {
            transaction,
            ...(!isJointSender && { authorizer: joint.address }),
            multisig: joint.parameters,
        } satisfies AlgorandTransactionPayload,
        summary: summarizeAlgorandTransaction(transaction),
        chainData: chainDataOf(transaction),
    }
}

const payloadOf = (unsigned: UnsignedTransaction): AlgorandTransactionPayload =>
    unsigned.payload as AlgorandTransactionPayload

/** The transaction each wraps, unvalidated: for wrappers the wallet built itself. */
export const payloadTransactionsOf = (
    unsigned: UnsignedTransaction[],
): PeraTransaction[] => unsigned.map(u => payloadOf(u).transaction)

/**
 * Puts edited transactions back in their wrappers, keeping who signs and what
 * the summary says. The group id is re-read even for the same object, because
 * `assignGroupID` regroups in place.
 */
export const rewrapAlgorandTransactions = (
    original: UnsignedTransaction[],
    transactions: PeraTransaction[],
): UnsignedTransaction[] =>
    original.map((unsigned, index) => {
        const transaction = transactions[index]
        const chainData = chainDataOf(transaction)
        const isUnchanged =
            transaction === payloadOf(unsigned).transaction &&
            unsigned.chainData.family === 'algorand' &&
            unsigned.chainData.groupId === chainData.groupId
        if (isUnchanged) return unsigned
        return {
            ...unsigned,
            payload: { ...payloadOf(unsigned), transaction },
            chainData,
        }
    })

/**
 * Names `signer` as the one who signs, as an ARC-0001 `signers` entry does.
 * A multisig participant already signs through the multisig, so it stays as is.
 */
export const withDeclaredSigner = (
    unsigned: UnsignedTransaction,
    signer: string,
): UnsignedTransaction => {
    const { authorizer, ...payload } = payloadOf(unsigned)
    if (payload.multisig?.addresses.includes(signer)) return unsigned
    if (signer === (authorizer ?? payload.transaction.sender.toString())) {
        return unsigned
    }
    const isSender = signer === payload.transaction.sender.toString()
    return {
        ...unsigned,
        payload: isSender ? payload : { ...payload, authorizer: signer },
    }
}
