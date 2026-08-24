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

import algosdk, { type modelsv2, type Transaction } from 'algosdk'

import { getConformanceClient } from '../client'
import { formatFieldDiff } from './diff'
import { assertIntentComplete, compareIntent, type TxnIntent } from './intent'

export type ConfirmedTxn = modelsv2.PendingTransactionResponse

export type ExpectConformantParams = {
    intent: TxnIntent
    /** The exact bytes handed to algod, not a re-encoding of the builder's output. */
    signedBytes: Uint8Array
    txId: string
    /** The sender's ALGO balance read immediately before submission. */
    senderBalanceBefore: bigint
}

/** How many rounds to wait; LocalNet in dev mode confirms on the next block. */
const CONFIRMATION_ROUNDS = 10

const fail = (summary: string, diff?: string): never => {
    throw new Error(diff ? `${summary}\n${diff}` : summary)
}

const assertMatchesIntent = (
    label: string,
    intent: TxnIntent,
    txn: Transaction,
): void => {
    const { expected, actual } = compareIntent(intent, txn)
    const diff = formatFieldDiff(expected, actual)
    if (diff) {
        fail(`${label} does not match the declared intent:`, diff)
    }
}

const isSigned = (signed: algosdk.SignedTransaction): boolean =>
    Boolean(signed.sig ?? signed.msig ?? signed.lsig ?? signed.pqsig)

const isGrouped = (txn: Transaction): boolean =>
    txn.group !== undefined && txn.group.length > 0

/**
 * The ALGO the sender must have lost, derived from what the chain confirmed
 * rather than from the intent, so the intent comparison and the balance
 * assertion are two independent checks rather than one restated twice.
 *
 * `undefined` means the delta is not attributable to this transaction alone:
 * an application call can move ALGO through inner transactions, and a grouped
 * transaction shares the sender's balance with its siblings — those callers
 * assert balances themselves.
 */
const expectedBalanceDelta = (
    confirmed: ConfirmedTxn,
    balanceBefore: bigint,
): bigint | undefined => {
    const txn = confirmed.txn.txn
    if (isGrouped(txn)) return undefined
    if (txn.type === 'appl') return undefined

    const rewards = confirmed.senderRewards ?? 0n
    const sender = txn.sender.toString()

    if (txn.payment) {
        const { amount, receiver, closeRemainderTo } = txn.payment
        // A close-out sweeps the account: whatever it held after the amount and
        // the fee is what left, so the only correct expectation is zero.
        if (closeRemainderTo) return -balanceBefore
        const credited = receiver.toString() === sender ? amount : 0n
        return rewards - txn.fee - amount + credited
    }

    // asset transfer, asset config, asset freeze, key registration: no ALGO
    // moves, only the fee is charged.
    return rewards - txn.fee
}

/**
 * Asserts that the bytes actually submitted, and the transaction the chain
 * actually confirmed, both match `intent` field-for-field, that the fee charged
 * is the declared one, and that the sender's ALGO balance moved by exactly what
 * the confirmed transaction accounts for.
 *
 * Fields the intent declares are compared — and a declared field the chain does
 * not carry is a failure, not an omission. Fields it omits are not compared,
 * except the account-handing ones (`rekeyTo`, `assetSender`, the close-tos, the
 * `acfg` roles, `nonParticipation`), where omission asserts absence.
 */
export const expectConformant = async (
    params: ExpectConformantParams,
): Promise<ConfirmedTxn> => {
    const { intent, signedBytes, txId, senderBalanceBefore } = params
    const algorand = getConformanceClient()
    const algod = algorand.client.algod

    assertIntentComplete(intent)

    const submitted = algosdk.decodeSignedTransaction(signedBytes)
    if (!isSigned(submitted)) {
        fail('submitted transaction carries no signature')
    }
    // Without this the whole assertion could be run against someone else's
    // confirmed transaction while the submitted bytes went nowhere.
    if (submitted.txn.txID() !== txId) {
        fail(
            `submitted bytes are not the transaction being asserted: bytes are ${submitted.txn.txID()}, txId is ${txId}`,
        )
    }
    // Grouping silently disables the balance assertion below, so it has to be
    // declared rather than discovered: an undeclared group would leave this
    // helper asserting less than the caller thinks it does.
    if (isGrouped(submitted.txn) && intent.groupSize === undefined) {
        fail(
            `transaction ${txId} carries a group id; declare groupSize on the intent so the group is asserted and the sender's balance is accounted for by the caller`,
        )
    }
    assertMatchesIntent('submitted transaction', intent, submitted.txn)

    const confirmed = await algosdk.waitForConfirmation(
        algod,
        txId,
        CONFIRMATION_ROUNDS,
    )
    if (confirmed.poolError) {
        fail(`transaction ${txId} was rejected: ${confirmed.poolError}`)
    }
    if (!confirmed.confirmedRound) {
        fail(`transaction ${txId} has no confirmed round`)
    }
    if (confirmed.txn.txn.txID() !== txId) {
        fail(
            `algod returned ${confirmed.txn.txn.txID()} for ${txId}; the confirmed transaction is not the submitted one`,
        )
    }
    assertMatchesIntent('confirmed transaction', intent, confirmed.txn.txn)

    const chargedFee = confirmed.txn.txn.fee
    if (chargedFee !== intent.fee) {
        fail(
            `the chain charged ${chargedFee}, the intent declared ${intent.fee}`,
        )
    }
    // A fee-pooled group leg may legitimately pay zero while a sibling covers
    // it, and one leg cannot see the group's total — the caller asserts that.
    // For a lone transaction the node's own minimum still applies.
    if ((intent.groupSize ?? 1) === 1) {
        const { minFee } = await algod.getTransactionParams().do()
        if (chargedFee < BigInt(minFee)) {
            fail(
                `fee ${chargedFee} is below the node's minimum ${minFee} for ${txId}`,
            )
        }
    }

    const expectedDelta = expectedBalanceDelta(confirmed, senderBalanceBefore)
    if (expectedDelta !== undefined) {
        const { balance } = await algorand.account.getInformation(intent.sender)
        const actualDelta = balance.microAlgo - senderBalanceBefore
        if (actualDelta !== expectedDelta) {
            fail(
                `sender balance moved by ${actualDelta} microAlgos, expected ${expectedDelta}`,
                formatFieldDiff(
                    {
                        balanceAfter: senderBalanceBefore + expectedDelta,
                    },
                    { balanceAfter: balance.microAlgo },
                ),
            )
        }
    }

    return confirmed
}
