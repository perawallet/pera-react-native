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

import { beforeEach, describe, expect, test } from 'vitest'
import '../../__tests__/registerAlgorandAccounts'
import { assignGroupID } from 'algosdk'
import {
    useAccountChainStateStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { seedAuthority } from '../../accounts/__tests__/seedAuthority'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { encodeTransactionRaw } from '../../blockchain'
import {
    decodeAlgorandMultisigTransaction,
    payloadTransactionsOf,
    rewrapAlgorandTransactions,
    toAlgorandUnsignedTransaction,
    toAlgorandUnsignedTransactions,
    withDeclaredSigner,
} from '../unsignedAlgorandTransactions'
import { readAlgorandTransaction } from '../planner'
import {
    MAINNET_GENESIS_HASH,
    makeTestAddress,
    makeTestAssetTransferTx,
    makeTestPaymentTx,
} from './transactions'

const SCOPE = scopeForLegacyNetwork('mainnet')
const SENDER = makeTestAddress(1)
const AUTHORITY = makeTestAddress(2)
const RECEIVER = makeTestAddress(3)
const PARTICIPANT_A = makeTestAddress(4).toString()
const PARTICIPANT_B = makeTestAddress(5).toString()

const local = (address: string): WalletAccount =>
    ({
        id: address,
        custody: { kind: 'local', seed: null },
        chains: { [ALGORAND_CHAIN_ID]: { address, keyPairId: address } },
    }) as unknown as WalletAccount

const multisig = (address: string): WalletAccount =>
    ({
        id: address,
        custody: { kind: 'multisig' },
        chains: {
            [ALGORAND_CHAIN_ID]: {
                address,
                native: {
                    family: 'algorand',
                    multisig: {
                        version: 1,
                        threshold: 2,
                        addresses: [PARTICIPANT_A, PARTICIPANT_B],
                    },
                },
            },
        },
    }) as unknown as WalletAccount

const payment = (
    overrides: Parameters<typeof makeTestPaymentTx>[1] = {
        receiver: RECEIVER,
    },
) =>
    makeTestPaymentTx(SENDER, {
        genesisHash: MAINNET_GENESIS_HASH,
        ...overrides,
    })

beforeEach(() => {
    useAccountChainStateStore.getState().resetState()
})

describe('toAlgorandUnsignedTransaction', () => {
    test('wraps a transaction the planner reads back as the same transaction, signed by its sender', () => {
        const transaction = payment({ receiver: RECEIVER, amount: 5n })

        const unsigned = toAlgorandUnsignedTransaction(transaction, {
            scope: SCOPE,
            accounts: [local(SENDER.toString())],
        })

        const read = readAlgorandTransaction(unsigned)
        expect(read.transaction).toBe(transaction)
        expect(read.signer).toBe(SENDER.toString())
        expect(unsigned.scope).toBe(SCOPE)
    })

    test("names a rekeyed sender's authority as the signer, so the planner never signs with the sender's own key", () => {
        seedAuthority(SENDER.toString(), AUTHORITY.toString(), SCOPE)

        const unsigned = toAlgorandUnsignedTransaction(payment(), {
            scope: SCOPE,
            accounts: [local(SENDER.toString()), local(AUTHORITY.toString())],
        })

        expect(readAlgorandTransaction(unsigned).signer).toBe(
            AUTHORITY.toString(),
        )
    })

    test('carries the multisig a multisig sender signs through', () => {
        const unsigned = toAlgorandUnsignedTransaction(payment(), {
            scope: SCOPE,
            accounts: [multisig(SENDER.toString())],
        })

        expect(unsigned.payload).toMatchObject({
            multisig: {
                version: 1,
                threshold: 2,
                addresses: [PARTICIPANT_A, PARTICIPANT_B],
            },
        })
    })

    test('records the group, rekey and close-out in chainData', () => {
        const [grouped] = assignGroupID([
            payment({
                receiver: RECEIVER,
                rekeyTo: AUTHORITY,
                closeRemainderTo: RECEIVER,
            }),
            payment(),
        ])

        const unsigned = toAlgorandUnsignedTransaction(grouped, {
            scope: SCOPE,
            accounts: [],
        })

        expect(unsigned.chainData).toEqual({
            family: 'algorand',
            groupId: encodeToBase64(grouped.group!),
            rekeyTo: AUTHORITY.toString(),
            closeRemainderTo: RECEIVER.toString(),
        })
    })

    test.each([
        [
            'an ALGO payment',
            () => payment({ receiver: RECEIVER, amount: 7n }),
            { kind: 'transfer', icon: 'send', direction: 'out' },
        ],
        [
            'an asset transfer',
            () =>
                makeTestAssetTransferTx(SENDER, {
                    assetIndex: 31566704n,
                    receiver: RECEIVER,
                    amount: 3n,
                }),
            { kind: 'token-transfer', icon: 'send' },
        ],
        [
            'an asset opt-in',
            () =>
                makeTestAssetTransferTx(SENDER, {
                    assetIndex: 31566704n,
                    receiver: SENDER,
                }),
            { kind: 'chain-specific', icon: 'opt-in' },
        ],
        [
            'an asset opt-out',
            () =>
                makeTestAssetTransferTx(SENDER, {
                    assetIndex: 31566704n,
                    receiver: SENDER,
                    closeRemainderTo: RECEIVER,
                }),
            { kind: 'chain-specific', icon: 'opt-out' },
        ],
    ])('summarises %s by what it does', (_name, build, expected) => {
        const unsigned = toAlgorandUnsignedTransaction(build(), {
            scope: SCOPE,
            accounts: [],
        })

        expect(unsigned.summary).toMatchObject(expected)
    })

    test("keeps a builder's own summary", () => {
        const summary = {
            kind: 'swap' as const,
            title: { key: 'swap' },
            direction: 'none' as const,
            icon: 'swap' as const,
        }

        const unsigned = toAlgorandUnsignedTransaction(
            payment(),
            { scope: SCOPE, accounts: [] },
            summary,
        )

        expect(unsigned.summary).toBe(summary)
    })
})

describe('rewrapAlgorandTransactions', () => {
    test('returns an unedited wrapper as it was', () => {
        const wrapped = toAlgorandUnsignedTransactions([payment()], {
            scope: SCOPE,
            accounts: [],
        })

        const rewrapped = rewrapAlgorandTransactions(
            wrapped,
            payloadTransactionsOf(wrapped),
        )

        expect(rewrapped[0]).toBe(wrapped[0])
    })

    test('puts an edited transaction back with its signer and summary, and re-reads the group', () => {
        seedAuthority(SENDER.toString(), AUTHORITY.toString(), SCOPE)
        const wrapped = toAlgorandUnsignedTransactions([payment(), payment()], {
            scope: SCOPE,
            accounts: [local(SENDER.toString())],
        })
        const regrouped = assignGroupID(payloadTransactionsOf(wrapped))

        const rewrapped = rewrapAlgorandTransactions(wrapped, regrouped)

        expect(readAlgorandTransaction(rewrapped[0]).signer).toBe(
            AUTHORITY.toString(),
        )
        expect(rewrapped[0].summary).toBe(wrapped[0].summary)
        expect(rewrapped[0].chainData).toMatchObject({
            groupId: encodeToBase64(regrouped[0].group!),
        })
    })
})

describe('withDeclaredSigner', () => {
    const wrapped = (accounts: WalletAccount[] = []) =>
        toAlgorandUnsignedTransaction(payment(), { scope: SCOPE, accounts })

    test('names a declared authority as the signer', () => {
        const declared = withDeclaredSigner(wrapped(), AUTHORITY.toString())

        expect(readAlgorandTransaction(declared).signer).toBe(
            AUTHORITY.toString(),
        )
    })

    test('lets a sender declared as its own signer drop a recorded authority', () => {
        seedAuthority(SENDER.toString(), AUTHORITY.toString(), SCOPE)
        const rekeyed = wrapped([local(SENDER.toString())])

        const declared = withDeclaredSigner(rekeyed, SENDER.toString())

        expect(readAlgorandTransaction(declared).signer).toBe(SENDER.toString())
    })

    test('keeps a multisig participant signing through the multisig', () => {
        const joint = wrapped([multisig(SENDER.toString())])

        expect(withDeclaredSigner(joint, PARTICIPANT_A)).toBe(joint)
    })
})

describe('decodeAlgorandMultisigTransaction', () => {
    const joint = {
        address: SENDER.toString(),
        parameters: {
            version: 1,
            threshold: 2,
            addresses: [PARTICIPANT_A, PARTICIPANT_B],
        },
    }

    test("signs a joint account's own transaction through its participants", () => {
        const bytes = encodeTransactionRaw(payment())

        const unsigned = decodeAlgorandMultisigTransaction(bytes, joint, SCOPE)

        expect(unsigned.payload).toMatchObject({
            multisig: joint.parameters,
        })
        expect(unsigned.payload).not.toHaveProperty('authorizer')
    })

    test('names the joint account as the authority of a sender rekeyed to it', () => {
        const bytes = encodeTransactionRaw(
            makeTestPaymentTx(RECEIVER, {
                receiver: SENDER,
                genesisHash: MAINNET_GENESIS_HASH,
            }),
        )

        const unsigned = decodeAlgorandMultisigTransaction(bytes, joint, SCOPE)

        expect(unsigned.payload).toMatchObject({
            authorizer: SENDER.toString(),
            multisig: joint.parameters,
        })
    })
})
