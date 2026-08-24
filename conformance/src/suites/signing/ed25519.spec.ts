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

import { createAlgo25Account, fundAccount } from '../../harness/accounts'
import { algokeySign } from '../../harness/algokey'
import type { TxnIntent } from '../../harness/assert/intent'
import { expectConformant } from '../../harness/assert/roundTrip'
import {
    buildTxn,
    signWithKeystore,
    submitAndConfirm,
} from '../../harness/build'
import { balanceOf } from '../../harness/client'
import { createConformanceKeyStore } from '../../harness/keystore'

/**
 * Baseline for the suite: a plain Ed25519 spend signed through the keystore
 * must be byte-identical to the same unsigned transaction signed by algokey,
 * and the node must accept it. Every other file in this suite is a variation
 * on this pair of assertions (multisig, rekeyed, quantum).
 */
describe('ed25519 signing conformance', () => {
    it('matches algokey byte-for-byte and is accepted by the node', async () => {
        const keyStore = await createConformanceKeyStore()
        const sender = await createAlgo25Account(keyStore)
        const receiver = await createAlgo25Account(keyStore)
        await fundAccount(sender.address, 2_000_000n)

        const amount = 150_000n
        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
            })
        })

        const keystoreSignedBytes = await signWithKeystore(
            keyStore,
            sender,
            txn,
        )
        // algokeySign takes the bare unsigned-transaction blob, not the "TX"-prefixed
        // signing preimage — see the comment on algokeySign in harness/algokey.ts.
        const oracleSignedBytes = await algokeySign({
            mnemonic: sender.mnemonic,
            unsignedTxn: algosdk.encodeUnsignedTransaction(txn),
        })

        // Byte-parity: catches a wrong preimage or signing bug offline, without
        // ever touching the node.
        expect(keystoreSignedBytes).toEqual(oracleSignedBytes)

        const senderBalanceBefore = await balanceOf(sender.address)
        const { txId } = await submitAndConfirm(keystoreSignedBytes)

        const intent: TxnIntent = {
            type: 'pay',
            sender: sender.address,
            receiver: receiver.address,
            amount,
            fee: txn.fee,
        }

        // Node acceptance: catches anything byte-parity can't, end-to-end.
        await expectConformant({
            intent,
            signedBytes: keystoreSignedBytes,
            txId,
            senderBalanceBefore,
        })
    })
})
