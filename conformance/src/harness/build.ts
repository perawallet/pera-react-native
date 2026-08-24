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

import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { KeyStore } from '@algorandfoundation/keystore-core'
import algosdk, {
    Address,
    encodeMsgpack,
    SignedTransaction,
    type modelsv2,
    type Transaction,
} from 'algosdk'

import {
    assemblePQSignedTransaction,
    pqSigningDigest,
} from '@perawallet/wallet-core-blockchain/pq/quantumAdapter'
import { DEFAULT_PQ_SCHEME_ID } from '@perawallet/wallet-core-blockchain/pq/schemes'
import { encodeTransaction } from '@perawallet/wallet-core-blockchain/utils/transact'

import type { ConformanceAccount } from './accounts'
import { getConformanceClient } from './client'

export type ConformanceComposer = ReturnType<AlgorandClient['newGroup']>

/** The app's validity window (see `useAlgorandClient`), not AlgoKit's default. */
const VALIDITY_WINDOW = 1000

/** How many rounds a submitted transaction is given to confirm. */
const CONFIRMATION_ROUNDS = 10

/**
 * The app never signs through AlgoKit — signing is routed via the XState
 * pipeline — but `TransactionComposer.build()` still resolves a signer per
 * sender. `useAlgorandClient` registers a throwing placeholder for exactly this
 * reason; the conformance harness registers the same one so a builder that
 * accidentally signs through AlgoKit fails loudly instead of bypassing the
 * keystore under test.
 */
const buildOnlySigner = (): Promise<Uint8Array[]> => {
    throw new Error(
        'the conformance harness must sign through the keystore, not through AlgoKit',
    )
}

const buildClient = (): AlgorandClient => {
    const client = getConformanceClient()
    client.setDefaultValidityWindow(VALIDITY_WINDOW)
    client.setDefaultSigner(buildOnlySigner)
    return client
}

/**
 * Builds an unsigned group by making the same `newGroup().addX(...)` composer
 * calls the app's send hooks make, which is as close to the app's builders as
 * headless code can get: every builder in `packages/transactions` is a React
 * hook with no pure entry point.
 *
 * AlgoKit assigns the group id during `build()` whenever there is more than one
 * transaction, exactly as it does in the app.
 */
export const buildGroup = async (
    compose: (composer: ConformanceComposer) => void,
): Promise<Transaction[]> => {
    const composer = buildClient().newGroup()
    compose(composer)
    const { transactions } = await composer.build()
    return transactions.map(withSigner => withSigner.txn)
}

export const buildTxn = async (
    compose: (composer: ConformanceComposer) => void,
): Promise<Transaction> => {
    const transactions = await buildGroup(compose)
    if (transactions.length !== 1) {
        throw new Error(
            `buildTxn expects exactly one transaction, got ${transactions.length}`,
        )
    }
    return transactions[0]
}

const signTransaction = async (
    keyStore: KeyStore<void>,
    account: ConformanceAccount,
    txn: Transaction,
): Promise<SignedTransaction> => {
    if (account.kind === 'quantum') {
        const { publicKey } = await keyStore.export(account.keyId)
        if (!publicKey) {
            throw new Error(`quantum key ${account.keyId} has no public key`)
        }
        return assemblePQSignedTransaction({
            txn,
            signature: {
                schemeId: DEFAULT_PQ_SCHEME_ID,
                publicKey,
                signature: await keyStore.sign(
                    account.keyId,
                    pqSigningDigest(txn),
                ),
            },
        })
    }

    const signature = await keyStore.sign(account.keyId, encodeTransaction(txn))
    return new SignedTransaction({
        txn,
        sig: signature,
        // A signer that is not the sender is the rekey case, and the envelope
        // has to name it or the node cannot find the authorizing key.
        sgnr:
            account.address === txn.sender.toString()
                ? undefined
                : Address.fromString(account.address),
    })
}

/**
 * Signs `txn` with `account`'s key and returns the msgpack envelope bytes — the
 * exact bytes to hand algod, and the exact bytes `expectConformant` decodes.
 */
export const signWithKeystore = async (
    keyStore: KeyStore<void>,
    account: ConformanceAccount,
    txn: Transaction,
): Promise<Uint8Array> =>
    encodeMsgpack(await signTransaction(keyStore, account, txn))

/** Signs every transaction of a group with the same account, in order. */
export const signGroupWithKeystore = async (
    keyStore: KeyStore<void>,
    account: ConformanceAccount,
    txns: Transaction[],
): Promise<Uint8Array[]> => {
    const signed: Uint8Array[] = []
    for (const txn of txns) {
        signed.push(await signWithKeystore(keyStore, account, txn))
    }
    return signed
}

export type SubmissionResult = {
    /** The first transaction's id. */
    txId: string
    txIds: string[]
    /** The confirmation of {@link txId}, so callers need not wait twice. */
    confirmed: modelsv2.PendingTransactionResponse
}

/**
 * Submits raw signed bytes and waits for confirmation. Submission errors are
 * left to propagate untouched: the suites that assert rejection behaviour need
 * algod's own error, not a wrapped one.
 */
export const submitAndConfirm = async (
    signedBytes: Uint8Array | Uint8Array[],
): Promise<SubmissionResult> => {
    const group = Array.isArray(signedBytes) ? signedBytes : [signedBytes]
    const txIds = group.map(bytes =>
        algosdk.decodeSignedTransaction(bytes).txn.txID(),
    )

    const algod = getConformanceClient().client.algod
    const { txid } = await algod.sendRawTransaction(group).do()
    if (txid !== txIds[0]) {
        throw new Error(
            `algod acknowledged ${txid} but the submitted bytes are ${txIds[0]}`,
        )
    }

    const confirmed = await algosdk.waitForConfirmation(
        algod,
        txIds[0],
        CONFIRMATION_ROUNDS,
    )
    return { txId: txIds[0], txIds, confirmed }
}

export type TestAssetParams = {
    /** Base units, default 1_000_000. */
    total?: bigint
    decimals?: number
    assetName?: string
    unitName?: string
    defaultFrozen?: boolean
    manager?: string
    reserve?: string
    freeze?: string
    clawback?: string
}

/**
 * Creates an asset owned by `creator` and returns its id.
 *
 * Takes the keystore explicitly rather than reading it off the account: a
 * {@link ConformanceAccount} is only key metadata, the sealed material lives in
 * the keystore that minted it.
 */
export const createTestAsset = async (
    keyStore: KeyStore<void>,
    creator: ConformanceAccount,
    params: TestAssetParams = {},
): Promise<bigint> => {
    const { total = 1_000_000n, decimals = 0, ...rest } = params
    const txn = await buildTxn(composer => {
        composer.addAssetCreate({
            sender: creator.address,
            total,
            decimals,
            ...rest,
        })
    })

    const { txId, confirmed } = await submitAndConfirm(
        await signWithKeystore(keyStore, creator, txn),
    )
    if (confirmed.assetIndex === undefined) {
        throw new Error(`asset creation ${txId} confirmed without an asset id`)
    }
    return confirmed.assetIndex
}
