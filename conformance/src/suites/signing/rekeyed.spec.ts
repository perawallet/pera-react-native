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
import { beforeAll, describe, expect, it } from 'vitest'

import {
    createAlgo25Account,
    fundAccount,
    type ConformanceAccount,
} from '../../harness/accounts'
import { algokeySign } from '../../harness/algokey'
import type { TxnIntent } from '../../harness/assert/intent'
import { expectConformant } from '../../harness/assert/roundTrip'
import {
    buildTxn,
    signWithKeystore,
    submitAndConfirm,
} from '../../harness/build'
import { getConformanceClient } from '../../harness/client'
import {
    createConformanceKeyStore,
    type ConformanceKeyStore,
} from '../../harness/keystore'

const balanceOf = async (address: string): Promise<bigint> =>
    (await getConformanceClient().account.getInformation(address)).balance
        .microAlgo

const authAddrOf = async (address: string): Promise<string | undefined> =>
    (
        await getConformanceClient()
            .client.algod.accountInformation(address)
            .do()
    ).authAddr?.toString()

/**
 * Full construction-level rekey mechanics (rekey-in, rekey-out, auth-addr
 * assertions) already live in
 * `suites/construction/rekey.spec.ts`. This file is narrower: given an
 * already-rekeyed account, does the keystore sign the exact same bytes a real
 * signer would? A wrong `authAddr`/`sgnr` on a rekeyed account is silently
 * accepted by every mock and rejected only by a real node — the second case
 * here is what catches it.
 */
describe('rekeyed signing conformance', () => {
    let keyStore: ConformanceKeyStore
    let source: ConformanceAccount
    let newAuth: ConformanceAccount
    let receiver: ConformanceAccount

    beforeAll(async () => {
        keyStore = await createConformanceKeyStore()
        source = await createAlgo25Account(keyStore)
        newAuth = await createAlgo25Account(keyStore)
        receiver = await createAlgo25Account(keyStore)
        await fundAccount(source.address, 5_000_000n)
        // Below the 100_000 microAlgo minimum balance, a brand-new account
        // cannot hold the small spend amounts sent to it below.
        await fundAccount(receiver.address, 500_000n)

        const rekeyTxn = await buildTxn(composer => {
            composer.addPayment({
                sender: source.address,
                receiver: source.address,
                amount: microAlgo(0n),
                rekeyTo: newAuth.address,
            })
        })
        await submitAndConfirm(
            await signWithKeystore(keyStore, source, rekeyTxn),
        )
        // Both `it` blocks below rely on this having actually landed on-chain —
        // asserted here, concretely, so a partial `-t` run that only selects one
        // of them fails loudly on a broken rekey rather than passing vacuously.
        if ((await authAddrOf(source.address)) !== newAuth.address) {
            throw new Error(
                `setup failed: source auth-addr is not newAuth after rekey`,
            )
        }
    })

    it("signs a spend from source with newAuth's key: sgnr is newAuth, matches algokey byte-for-byte, and the node accepts it", async () => {
        const senderBalanceBefore = await balanceOf(source.address)
        const amount = 1000n

        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: source.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
            })
        })

        const keystoreSignedBytes = await signWithKeystore(
            keyStore,
            newAuth,
            txn,
        )
        const decoded = algosdk.decodeSignedTransaction(keystoreSignedBytes)
        expect(decoded.sgnr?.toString()).toBe(newAuth.address)

        // algokey's own `sign` compares the mnemonic's derived address against
        // the transaction's sender and populates `sgnr` itself when they differ
        // — no separate "rekeyed sign" CLI command is needed.
        const oracleSignedBytes = await algokeySign({
            mnemonic: newAuth.mnemonic,
            unsignedTxn: algosdk.encodeUnsignedTransaction(txn),
        })

        // Byte-parity: catches a wrong preimage, a wrong signature, or a wrong
        // `sgnr` offline, without ever touching the node.
        expect(keystoreSignedBytes).toEqual(oracleSignedBytes)

        const { txId } = await submitAndConfirm(keystoreSignedBytes)

        const intent: TxnIntent = {
            type: 'pay',
            sender: source.address,
            receiver: receiver.address,
            amount,
            fee: txn.fee,
        }

        // Node acceptance: catches anything byte-parity can't, end-to-end —
        // in particular that algod actually resolves `sgnr` against the
        // account's on-chain auth-addr rather than trusting the envelope.
        await expectConformant({
            intent,
            signedBytes: keystoreSignedBytes,
            txId,
            senderBalanceBefore,
        })
    })

    it("rejects a spend signed by source's own key once rekeyed", async () => {
        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: source.address,
                receiver: receiver.address,
                amount: microAlgo(1000n),
            })
        })
        // source's own key is well-formed and produces a validly-signed
        // envelope; only a real node — checking the envelope's signer against
        // the account's on-chain auth-addr — can reject it. A mock signer would
        // happily accept whatever key it's handed.
        const signedBytes = await signWithKeystore(keyStore, source, txn)

        // algod's own rejection names the auth-addr it expects and the key
        // that actually signed, proving the account really is rekeyed on-chain
        // (not merely assumed) and that algod, not the app, is the one
        // enforcing it.
        await expect(submitAndConfirm(signedBytes)).rejects.toThrow(
            new RegExp(
                `should have been authorized by ${newAuth.address} but was actually authorized by ${source.address}`,
            ),
        )
    })
})
