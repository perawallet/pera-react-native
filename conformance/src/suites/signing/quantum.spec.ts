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

import { FALLBACK_PQ_MULTIPLIER } from '@perawallet/wallet-core-blockchain/constants'
import { calculateMinTxnFee } from '@perawallet/wallet-core-blockchain/fees/feeCalculator'
import { pqSigningDigest } from '@perawallet/wallet-core-blockchain/pq/quantumAdapter'

import {
    createAlgo25Account,
    createQuantumAccount,
    fundAccount,
} from '../../harness/accounts'
import { algokeyQuantumSign } from '../../harness/algokey'
import type { TxnIntent } from '../../harness/assert/intent'
import { expectConformant } from '../../harness/assert/roundTrip'
import {
    buildTxn,
    signWithKeystore,
    submitAndConfirm,
} from '../../harness/build'
import { getConformanceClient } from '../../harness/client'
import { createConformanceKeyStore } from '../../harness/keystore'

const balanceOf = async (address: string): Promise<bigint> =>
    (await getConformanceClient().account.getInformation(address)).balance
        .microAlgo

/**
 * PERA-4643: the quantum signing preimage was `sha512_256(bytesToSign())`
 * instead of `bytesToSign()`. Every unit test passed — the bug only showed up
 * against a real `pqsig`-capable node, which verifies the Falcon signature
 * over `HashRep(message)` directly and does its own internal hashing.
 * Re-hashing first changes the message and gets `falcon verify failed`.
 */
describe('quantum signing conformance', () => {
    it('pins the exact PERA-4643 preimage contract: pqSigningDigest is bytesToSign(), not a digest of it', async () => {
        const keyStore = await createConformanceKeyStore()
        const account = await createQuantumAccount(keyStore)
        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: account.address,
                receiver: account.address,
                amount: microAlgo(0n),
            })
        })

        // `pqSigningDigest`'s body is literally `txn.bytesToSign()` (see
        // quantumAdapter.ts), so this equality is definitional, not a
        // regression check by itself — it pins the contract in the one place a
        // future edit to `pqSigningDigest` would have to touch. The assertions
        // below (byte-parity against algokey, then node acceptance) are what
        // actually catch a reintroduced pre-hash: PERA-4643 passed every unit
        // test and only a real node caught it.
        expect(pqSigningDigest(txn)).toEqual(txn.bytesToSign())
    })

    it('matches algokeyQuantumSign byte-for-byte and is accepted by the node — the real proof the preimage is right', async () => {
        const keyStore = await createConformanceKeyStore()
        const sender = await createQuantumAccount(keyStore)
        const receiver = await createAlgo25Account(keyStore)
        await fundAccount(sender.address, 5_000_000n)

        const amount = 300_000n
        // A quantum-signed transaction pays a fee surcharge on top of the base
        // minimum (see suites/fees/quantum.spec.ts); the composer does not add
        // it automatically, so this suite pins it explicitly rather than
        // letting the submission fail on an unrelated fee-floor rejection.
        const { minFee } = await getConformanceClient()
            .client.algod.getTransactionParams()
            .do()
        const expectedFee = calculateMinTxnFee({
            baseMinFee: BigInt(minFee),
            isPQSigner: true,
            pqMultiplier: FALLBACK_PQ_MULTIPLIER,
        })
        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
                staticFee: microAlgo(expectedFee),
            })
        })

        const keystoreSignedBytes = await signWithKeystore(
            keyStore,
            sender,
            txn,
        )
        // algokeyQuantumSign takes the bare unsigned-transaction blob, not the
        // "TX"-prefixed signing preimage — see the comment on algokeyQuantumSign
        // in harness/algokey.ts.
        const oracleSignedBytes = await algokeyQuantumSign({
            mnemonic: sender.mnemonic,
            unsignedTxn: algosdk.encodeUnsignedTransaction(txn),
        })

        // Byte-parity: catches a wrong preimage (exactly PERA-4643's failure
        // mode) offline, without ever touching the node — algokey's own Falcon
        // signer produces a different signature for a wrong preimage, so a
        // regression here fails before submission.
        expect(keystoreSignedBytes).toEqual(oracleSignedBytes)

        const senderBalanceBefore = await balanceOf(sender.address)
        const { txId } = await submitAndConfirm(keystoreSignedBytes)

        const intent: TxnIntent = {
            type: 'pay',
            sender: sender.address,
            receiver: receiver.address,
            amount,
            // The value computed above, not read back off the built
            // transaction — matches suites/fees/quantum.spec.ts's stronger
            // form, though here it's a precondition for submission rather
            // than the thing under test.
            fee: expectedFee,
        }

        // Node acceptance: the actual PERA-4643 catch. Byte-parity against
        // algokey proves the app matches an independent Falcon implementation;
        // this proves a real `pqsig`-capable node's own verifier accepts the
        // signature end-to-end, which unit tests and mocks never exercised.
        await expectConformant({
            intent,
            signedBytes: keystoreSignedBytes,
            txId,
            senderBalanceBefore,
        })
    })
})
