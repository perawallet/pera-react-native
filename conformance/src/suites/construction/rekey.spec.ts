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
import { beforeAll, describe, expect, it } from 'vitest'

import {
    createAlgo25Account,
    fundAccount,
    type ConformanceAccount,
} from '../../harness/accounts'
import type { TxnIntent } from '../../harness/assert/intent'
import { expectConformant } from '../../harness/assert/roundTrip'
import {
    buildTxn,
    signWithKeystore,
    submitAndConfirm,
} from '../../harness/build'
import { authAddrOf, balanceOf } from '../../harness/client'
import {
    createConformanceKeyStore,
    type ConformanceKeyStore,
} from '../../harness/keystore'

/**
 * Full rekey lifecycle against a real node. A mock signer would happily sign
 * with whatever key a caller hands it regardless of the account's actual
 * auth-addr; only a real node enforces that the signer named in the envelope
 * matches the address algod actually has on file, so this suite is the one
 * place a wrong `authAddr` (or a rekey that silently never landed) gets
 * caught.
 */
describe('rekey construction conformance', () => {
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
    })

    it('rekey-in: source auth-addr becomes newAuth', async () => {
        const senderBalanceBefore = await balanceOf(source.address)

        // Mirrors useSubmitRekeyMutation: a 0-amount self-payment carrying
        // rekeyTo, signed by the CURRENT auth (source's own key, pre-rekey).
        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: source.address,
                receiver: source.address,
                amount: microAlgo(0n),
                rekeyTo: newAuth.address,
            })
        })
        const signedBytes = await signWithKeystore(keyStore, source, txn)
        const { txId } = await submitAndConfirm(signedBytes)

        const intent: TxnIntent = {
            type: 'pay',
            sender: source.address,
            receiver: source.address,
            amount: 0n,
            rekeyTo: newAuth.address,
            fee: txn.fee,
        }

        await expectConformant({
            intent,
            signedBytes,
            txId,
            senderBalanceBefore,
        })

        expect(await authAddrOf(source.address)).toBe(newAuth.address)
    })

    // Proves the rekey actually landed on-chain rather than merely being
    // assumed: a builder bug that sent the wrong rekeyTo (or a keystore bug
    // that never really rekeyed) would leave source's original key still
    // authorized, and this case would silently pass under a mock signer that
    // never checks auth-addr against the node's account state.
    it('rejects a spend signed by the original key once rekeyed', async () => {
        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: source.address,
                receiver: receiver.address,
                amount: microAlgo(1000n),
            })
        })
        const signedBytes = await signWithKeystore(keyStore, source, txn)

        await expect(submitAndConfirm(signedBytes)).rejects.toThrow(
            /should have been authorized by/,
        )
    })

    it('spends from source signed by the new auth key', async () => {
        const senderBalanceBefore = await balanceOf(source.address)
        const amount = 1000n

        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: source.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
            })
        })
        // source's spending key is now newAuth's; signWithKeystore names it in
        // `sgnr` because newAuth.address !== txn.sender.
        const signedBytes = await signWithKeystore(keyStore, newAuth, txn)
        const { txId } = await submitAndConfirm(signedBytes)

        const intent: TxnIntent = {
            type: 'pay',
            sender: source.address,
            receiver: receiver.address,
            amount,
            fee: txn.fee,
        }

        await expectConformant({
            intent,
            signedBytes,
            txId,
            senderBalanceBefore,
        })
    })

    it('rekey-out: source auth-addr clears once rekeyed back to itself', async () => {
        const senderBalanceBefore = await balanceOf(source.address)

        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: source.address,
                receiver: source.address,
                amount: microAlgo(0n),
                rekeyTo: source.address,
            })
        })
        // Still authorized by newAuth until this transaction confirms.
        const signedBytes = await signWithKeystore(keyStore, newAuth, txn)
        const { txId } = await submitAndConfirm(signedBytes)

        const intent: TxnIntent = {
            type: 'pay',
            sender: source.address,
            receiver: source.address,
            amount: 0n,
            rekeyTo: source.address,
            fee: txn.fee,
        }

        await expectConformant({
            intent,
            signedBytes,
            txId,
            senderBalanceBefore,
        })

        expect(await authAddrOf(source.address)).toBeUndefined()
    })
})
