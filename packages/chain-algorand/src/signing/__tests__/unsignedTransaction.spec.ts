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

import { afterEach, describe, expect, it } from 'vitest'
import '../../__tests__/registerAlgorandAccounts'
import { Decimal } from 'decimal.js'
import {
    Transaction,
    TransactionType,
    generateAccount,
    type Address,
} from 'algosdk'
import {
    useAccountChainStateStore,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import type { SigningResult } from '@perawallet/wallet-core-signing'
import { TransportError } from '@perawallet/wallet-core-signing'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import {
    decodeSignedTransaction,
    encodeSignedTransaction,
    encodeTransactionRaw,
} from '../../blockchain/utils/transact'
import { groupTransactions } from '../../blockchain'
import { standaloneAccount } from '../../__tests__/algorandAccounts'
import { seedAuthority } from '../../accounts/__tests__/seedAuthority'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { readAlgorandTransaction } from '../planner'
import {
    algorandSignedTransactionsOf,
    decodeUnsignedAlgorandTransaction,
    signedAlgorandTransactionFromBytes,
    summarizeAlgorandTransaction,
    toSignedAlgorandTransaction,
    toUnsignedAlgorandTransaction,
    withAlgorandTransaction,
} from '../unsignedTransaction'
import {
    MAINNET_GENESIS_HASH,
    TEST_SUGGESTED_PARAMS,
    makeTestAddress,
    makeTestAssetTransferTx,
    makeTestPaymentTx,
} from './transactions'

const SCOPE = { chainId: ALGORAND_CHAIN_ID, networkId: 'mainnet' } as const
const SENDER = makeTestAddress(1)
const RECEIVER = makeTestAddress(2)
const params = { ...TEST_SUGGESTED_PARAMS, genesisHash: MAINNET_GENESIS_HASH }

const payment = (receiver: Address = RECEIVER, amount = 5n) =>
    makeTestPaymentTx(SENDER, {
        receiver,
        amount,
        genesisHash: MAINNET_GENESIS_HASH,
    })

const ofType = (
    type: TransactionType,
    typeParams: Record<string, unknown>,
): Transaction =>
    new Transaction({
        type,
        sender: SENDER,
        suggestedParams: params,
        ...typeParams,
    })

describe('toUnsignedAlgorandTransaction', () => {
    it('carries the transaction as a payload the planner reads back for its scope', () => {
        const transaction = payment()

        const unsigned = toUnsignedAlgorandTransaction(transaction, SCOPE)

        expect(unsigned.scope).toEqual(SCOPE)
        expect(readAlgorandTransaction(unsigned).transaction).toBe(transaction)
    })

    it('records the group, rekey and close-out the transaction carries', () => {
        const closing = makeTestPaymentTx(SENDER, {
            receiver: RECEIVER,
            closeRemainderTo: RECEIVER,
            rekeyTo: RECEIVER,
            genesisHash: MAINNET_GENESIS_HASH,
        })
        const [grouped] = groupTransactions([closing, payment()])

        expect(toUnsignedAlgorandTransaction(grouped, SCOPE).chainData).toEqual(
            {
                family: 'algorand',
                groupId: encodeToBase64(grouped.group!),
                rekeyTo: RECEIVER.toString(),
                closeRemainderTo: RECEIVER.toString(),
            },
        )
    })

    it('leaves out the group, rekey and close-out a plain transaction lacks', () => {
        expect(
            toUnsignedAlgorandTransaction(payment(), SCOPE).chainData,
        ).toEqual({ family: 'algorand' })
    })

    describe('for a wallet sender', () => {
        const AUTHORITY = makeTestAddress(3).toString()

        afterEach(() => {
            useAccountsStore.getState().setAccounts([])
            useAccountChainStateStore.getState().resetState()
        })

        it('names the authority the sender is rekeyed to as its signer', () => {
            useAccountsStore
                .getState()
                .setAccounts([standaloneAccount(SENDER.toString())])
            seedAuthority(SENDER.toString(), AUTHORITY)

            const unsigned = toUnsignedAlgorandTransaction(payment(), SCOPE)

            expect(readAlgorandTransaction(unsigned).signer).toBe(AUTHORITY)
        })

        it('leaves a sender that signs for itself as its own signer', () => {
            useAccountsStore
                .getState()
                .setAccounts([standaloneAccount(SENDER.toString())])
            seedAuthority(SENDER.toString(), null)

            const unsigned = toUnsignedAlgorandTransaction(payment(), SCOPE)

            expect(unsigned.payload).not.toHaveProperty('authorizer')
            expect(readAlgorandTransaction(unsigned).signer).toBe(
                SENDER.toString(),
            )
        })
    })

    it('decodes wire bytes into the same payload', () => {
        const transaction = payment()

        const unsigned = decodeUnsignedAlgorandTransaction(
            encodeTransactionRaw(transaction),
            SCOPE,
        )

        expect(readAlgorandTransaction(unsigned).transaction.txID()).toBe(
            transaction.txID(),
        )
    })
})

describe('summarizeAlgorandTransaction', () => {
    it('summarises a payment as an outgoing ALGO transfer', () => {
        expect(summarizeAlgorandTransaction(payment())).toEqual({
            kind: 'transfer',
            title: { key: 'transactions.list_item.send' },
            direction: 'out',
            icon: 'send',
            counterparty: RECEIVER.toString(),
            amount: {
                assetRef: { chainId: ALGORAND_CHAIN_ID, assetId: '0' },
                value: new Decimal(5),
            },
        })
    })

    it('summarises a payment to the sender as a self transfer', () => {
        expect(summarizeAlgorandTransaction(payment(SENDER))).toMatchObject({
            direction: 'self',
            icon: 'self',
        })
    })

    it('summarises an asset transfer as a token transfer of that asset', () => {
        const transfer = makeTestAssetTransferTx(SENDER, {
            assetIndex: 31566704n,
            receiver: RECEIVER,
            amount: 7n,
        })

        expect(summarizeAlgorandTransaction(transfer)).toMatchObject({
            kind: 'token-transfer',
            counterparty: RECEIVER.toString(),
            amount: {
                assetRef: { chainId: ALGORAND_CHAIN_ID, assetId: '31566704' },
                value: new Decimal(7),
            },
        })
    })

    it('summarises a zero transfer to the sender as an opt-in', () => {
        const optIn = makeTestAssetTransferTx(SENDER, {
            assetIndex: 1n,
            receiver: SENDER,
        })

        expect(summarizeAlgorandTransaction(optIn)).toEqual({
            kind: 'chain-specific',
            title: { key: 'transactions.list_item.opt_in' },
            direction: 'none',
            icon: 'opt-in',
        })
    })

    it('summarises an asset close-out as an opt-out', () => {
        const optOut = makeTestAssetTransferTx(SENDER, {
            assetIndex: 1n,
            receiver: RECEIVER,
            closeRemainderTo: RECEIVER,
        })

        expect(summarizeAlgorandTransaction(optOut)).toMatchObject({
            title: { key: 'transactions.list_item.opt_out' },
            icon: 'opt-out',
        })
    })

    it.each([
        {
            name: 'an application call',
            transaction: () =>
                ofType(TransactionType.appl, {
                    appCallParams: { appIndex: 1n, onComplete: 0 },
                }),
            summary: {
                kind: 'contract-call',
                title: { key: 'transactions.list_item.app_call' },
                icon: 'contract-call',
            },
        },
        {
            name: 'a key registration',
            transaction: () =>
                ofType(TransactionType.keyreg, { keyregParams: {} }),
            summary: {
                kind: 'chain-specific',
                title: { key: 'transactions.list_item.key_registration' },
                icon: 'consensus',
            },
        },
        {
            name: 'an asset configuration',
            transaction: () =>
                ofType(TransactionType.acfg, {
                    assetConfigParams: { assetIndex: 1n },
                }),
            summary: {
                kind: 'chain-specific',
                title: { key: 'transactions.list_item.asset_config' },
                icon: 'asset-config',
            },
        },
        {
            name: 'an asset freeze',
            transaction: () =>
                ofType(TransactionType.afrz, {
                    assetFreezeParams: {
                        assetIndex: 1n,
                        freezeTarget: RECEIVER,
                        frozen: true,
                    },
                }),
            summary: {
                kind: 'chain-specific',
                title: { key: 'transactions.list_item.asset_freeze' },
                icon: 'asset-freeze',
            },
        },
    ])('summarises $name', ({ transaction, summary }) => {
        expect(summarizeAlgorandTransaction(transaction())).toEqual({
            ...summary,
            direction: 'none',
        })
    })
})

describe('withAlgorandTransaction', () => {
    it('returns the same request entry when its transaction is unchanged', () => {
        const transaction = payment()
        const unsigned = toUnsignedAlgorandTransaction(transaction, SCOPE)

        expect(withAlgorandTransaction(unsigned, transaction)).toBe(unsigned)
    })

    it('swaps in a changed transaction and recomputes what is derived from it', () => {
        const unsigned = toUnsignedAlgorandTransaction(payment(), SCOPE)
        const [regrouped] = groupTransactions([payment(), payment()])

        const updated = withAlgorandTransaction(unsigned, regrouped)

        expect(updated.scope).toEqual(SCOPE)
        expect(readAlgorandTransaction(updated).transaction).toBe(regrouped)
        expect(updated.chainData).toEqual({
            family: 'algorand',
            groupId: encodeToBase64(regrouped.group!),
        })
    })
})

describe('signed transactions', () => {
    const account = generateAccount()
    const signedBytes = makeTestPaymentTx(account.addr, {
        receiver: RECEIVER,
        genesisHash: MAINNET_GENESIS_HASH,
    }).signTxn(account.sk)

    it('encodes a signed envelope with its transaction id', () => {
        const signed = decodeSignedTransaction(signedBytes)

        expect(toSignedAlgorandTransaction(signed, SCOPE)).toEqual({
            scope: SCOPE,
            id: signed.txn.txID(),
            bytes: encodeSignedTransaction(signed),
        })
    })

    it('keeps bytes signed elsewhere exactly as they arrived', () => {
        const signed = signedAlgorandTransactionFromBytes(signedBytes, SCOPE)

        expect(signed.bytes).toBe(signedBytes)
        expect(signed.id).toBe(decodeSignedTransaction(signedBytes).txn.txID())
    })

    it('reads a planner-signed result as it is', () => {
        const planned = signedAlgorandTransactionFromBytes(signedBytes, SCOPE)
        const result: SigningResult = {
            signedData: { type: 'signed-transactions', signed: [planned] },
            signers: [],
        }

        expect(algorandSignedTransactionsOf(result, SCOPE)).toEqual([planned])
    })

    it('encodes a strategy-signed result, leaving an unsigned slot empty', () => {
        const signed = decodeSignedTransaction(signedBytes)
        const result: SigningResult = {
            signedData: {
                type: 'transactions',
                // A merged result leaves a hole where nothing signed.
                signed: [signed, undefined as never],
            },
            signers: [],
        }

        expect(algorandSignedTransactionsOf(result, SCOPE)).toEqual([
            toSignedAlgorandTransaction(signed, SCOPE),
            null,
        ])
    })

    it('refuses a result that carries no transactions', () => {
        const result: SigningResult = {
            signedData: { type: 'auth-data', signature: new Uint8Array() },
            signers: [],
        }

        expect(() => algorandSignedTransactionsOf(result, SCOPE)).toThrow(
            TransportError,
        )
    })
})
