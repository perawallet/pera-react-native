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

import { microAlgo } from '@algorandfoundation/algokit-utils'
import algosdk from 'algosdk'
import { describe, expect, it } from 'vitest'

import { assembleSignedMultisigTransactions } from '@perawallet/wallet-core-blockchain/utils/assembleSignedMultisigTransactions'
import { encodeTransaction } from '@perawallet/wallet-core-blockchain/utils/transact'

import {
    createAlgo25Account,
    createMultisigAccount,
    fundAccount,
    type ConformanceAccount,
    type ConformanceMultisigAccount,
} from '../../harness/accounts'
import { algokeyMultisigSign } from '../../harness/algokey'
import type { TxnIntent } from '../../harness/assert/intent'
import { expectConformant } from '../../harness/assert/roundTrip'
import { buildTxn, submitAndConfirm } from '../../harness/build'
import { getConformanceClient } from '../../harness/client'
import { createConformanceKeyStore } from '../../harness/keystore'

const balanceOf = async (address: string): Promise<bigint> =>
    (await getConformanceClient().account.getInformation(address)).balance
        .microAlgo

const toBase64 = (bytes: Uint8Array): string =>
    Buffer.from(bytes).toString('base64')

describe('multisig signing conformance', () => {
    it('rejects a single signature below a 2-of-3 threshold', async () => {
        const keyStore = await createConformanceKeyStore()
        const members: ConformanceAccount[] = [
            await createAlgo25Account(keyStore),
            await createAlgo25Account(keyStore),
            await createAlgo25Account(keyStore),
        ]
        const multisig: ConformanceMultisigAccount = createMultisigAccount(
            members,
            2,
        )
        const receiver = await createAlgo25Account(keyStore)
        await fundAccount(multisig.address, 3_000_000n)

        const mparams = {
            version: multisig.version,
            threshold: multisig.threshold,
            addrs: members.map(member => member.address),
        }
        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: multisig.address,
                receiver: receiver.address,
                amount: microAlgo(11_000n),
            })
        })

        // algosdk's own multisig preimage — the same shape `algokeyMultisigSign`
        // expects as `unsignedTxn` (msig.v/thr/subsig[].pk populated, sigs empty).
        const preimage = algosdk.createMultisigTransaction(txn, mparams)
        const sk = algosdk.mnemonicToSecretKey(members[0].mnemonic).sk
        const { blob: singleSignedBlob } =
            algosdk.appendSignMultisigTransaction(preimage, mparams, sk)

        // Only the node enforces the threshold on the envelope itself; nothing
        // upstream (the SDK, algokey) refuses to produce a below-threshold blob.
        // algod's own rejection ("multisig validation failed: Invalid number of
        // signatures") proves the threshold is enforced on-chain, not merely by
        // the app's own signer-count check before submission.
        await expect(submitAndConfirm(singleSignedBlob)).rejects.toThrow(
            /multisig validation failed: Invalid number of signatures/,
        )
    })

    it('assembles two signatures via assembleSignedMultisigTransactions, matches algokey byte-for-byte, and is accepted by the node', async () => {
        const keyStore = await createConformanceKeyStore()
        const members: ConformanceAccount[] = [
            await createAlgo25Account(keyStore),
            await createAlgo25Account(keyStore),
            await createAlgo25Account(keyStore),
        ]
        const multisig: ConformanceMultisigAccount = createMultisigAccount(
            members,
            2,
        )
        const receiver = await createAlgo25Account(keyStore)
        await fundAccount(multisig.address, 3_000_000n)
        // Below the 100_000 microAlgo minimum balance, a brand-new account
        // cannot hold the small spend amount sent to it below.
        await fundAccount(receiver.address, 200_000n)

        const mparams = {
            version: multisig.version,
            threshold: multisig.threshold,
            addrs: members.map(member => member.address),
        }
        const amount = 22_000n
        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: multisig.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
            })
        })

        const rawTxnBytes = algosdk.encodeUnsignedTransaction(txn)
        const [signer1, signer2] = members
        const sig1 = await keyStore.sign(signer1.keyId, encodeTransaction(txn))
        const sig2 = await keyStore.sign(signer2.keyId, encodeTransaction(txn))

        const assembled = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: [toBase64(rawTxnBytes)],
            participantAddresses: mparams.addrs,
            version: mparams.version,
            threshold: mparams.threshold,
            responses: [
                {
                    address: signer1.address,
                    response: 'signed',
                    signatures: [toBase64(sig1)],
                },
                {
                    address: signer2.address,
                    response: 'signed',
                    signatures: [toBase64(sig2)],
                },
            ],
        })
        if (assembled.kind !== 'success') {
            throw new Error(
                `expected success, got ${JSON.stringify(assembled)}`,
            )
        }
        const assembledBytes = assembled.signedTransactionsBytes[0]

        // Oracle: each participant signs the SAME bare preimage independently —
        // algokey's `multisig` command re-derives its output from the embedded
        // `txn` field on every invocation rather than merging onto a
        // partially-signed input, so feeding it a partial blob silently drops
        // the earlier signature instead of adding to it (verified empirically).
        // "Applied successively" means one oracle call after another (the harness
        // forbids concurrent oracle calls), then merged locally with algosdk's
        // own `mergeMultisigTransactions` — the same two-step a real multisig
        // cosigning round collapses into once every response is in.
        const preimage = algosdk.createMultisigTransaction(txn, mparams)
        const oraclePartial1 = await algokeyMultisigSign({
            mnemonic: signer1.mnemonic,
            unsignedTxn: preimage,
        })
        const oraclePartial2 = await algokeyMultisigSign({
            mnemonic: signer2.mnemonic,
            unsignedTxn: preimage,
        })
        const oracleFull = algosdk.mergeMultisigTransactions([
            oraclePartial1,
            oraclePartial2,
        ])

        // Byte-parity: catches a wrong signature or a wrong envelope assembly
        // offline, without ever touching the node.
        expect(assembledBytes).toEqual(oracleFull)

        const senderBalanceBefore = await balanceOf(multisig.address)
        const { txId } = await submitAndConfirm(assembledBytes)

        const intent: TxnIntent = {
            type: 'pay',
            sender: multisig.address,
            receiver: receiver.address,
            amount,
            fee: txn.fee,
        }

        // Node acceptance: catches anything byte-parity can't, end-to-end.
        await expectConformant({
            intent,
            signedBytes: assembledBytes,
            txId,
            senderBalanceBefore,
        })
    })

    it('returns insufficient-signatures for a below-threshold partial, rather than throwing', async () => {
        const keyStore = await createConformanceKeyStore()
        const members: ConformanceAccount[] = [
            await createAlgo25Account(keyStore),
            await createAlgo25Account(keyStore),
            await createAlgo25Account(keyStore),
        ]
        const multisig: ConformanceMultisigAccount = createMultisigAccount(
            members,
            2,
        )
        const receiver = await createAlgo25Account(keyStore)

        const mparams = {
            version: multisig.version,
            threshold: multisig.threshold,
            addrs: members.map(member => member.address),
        }
        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: multisig.address,
                receiver: receiver.address,
                amount: microAlgo(1000n),
            })
        })
        const rawTxnBytes = algosdk.encodeUnsignedTransaction(txn)
        const [signer1] = members
        const sig1 = await keyStore.sign(signer1.keyId, encodeTransaction(txn))

        const result = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: [toBase64(rawTxnBytes)],
            participantAddresses: mparams.addrs,
            version: mparams.version,
            threshold: mparams.threshold,
            responses: [
                {
                    address: signer1.address,
                    response: 'signed',
                    signatures: [toBase64(sig1)],
                },
            ],
        })

        expect(result).toEqual({
            kind: 'insufficient-signatures',
            txIndex: 0,
            validCount: 1,
            threshold: 2,
        })
    })
})
