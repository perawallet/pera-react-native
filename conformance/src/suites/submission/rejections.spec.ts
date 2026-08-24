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
import { describe, expect, it } from 'vitest'

import {
    AlgodErrorCode,
    toAlgodError,
} from '@perawallet/wallet-core-blockchain/errors'
import { groupTransactions } from '@perawallet/wallet-core-blockchain/utils/transact'

import { createAlgo25Account, fundAccount } from '../../harness/accounts'
import {
    buildTxn,
    createTestAsset,
    signWithKeystore,
    submitAndConfirm,
} from '../../harness/build'
import { getConformanceClient } from '../../harness/client'
import { createConformanceKeyStore } from '../../harness/keystore'

// The same encoding algod uses for group ids and txids: SHA512/256-sized (32
// byte) values rendered as unpadded RFC4648 base32 (algosdk's own `txID()` is
// `hi-base32.encode(hash).slice(0, 52)`, i.e. the same alphabet with the
// trailing '=' padding dropped). Verified byte-for-byte identical to
// algosdk's own encoding for 32-byte inputs before pinning the assertion
// below on it, so the corrupted-group-id case can interpolate concrete
// values instead of a guessed pattern.
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const encodeBase32NoPad = (bytes: Uint8Array): string => {
    let bits = 0
    let value = 0
    let output = ''
    for (const byte of bytes) {
        value = (value << 8) | byte
        bits += 8
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
            bits -= 5
        }
    }
    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
    }
    return output
}

const rejectionOf = async (submit: () => Promise<unknown>): Promise<Error> => {
    try {
        await submit()
    } catch (error) {
        return error as Error
    }
    throw new Error('expected the submission to be rejected, but it landed')
}

/**
 * Asserts the app's TYPED `AlgodErrorCode` for five real algod rejections,
 * never a raw node string. Each case creates its own accounts so a filtered
 * `-t` run exercises the same setup a full run would.
 *
 * Three of the five reveal a real gap between `parseAlgodMessage.ts`'s
 * regexes and algod 5.0.0-stable's actual wording — see the FINDING comments
 * on `overspend`, `expired lastValid`, and `corrupted group id` below and the
 * task report for detail. These are pinned to what `toAlgodError` ACTUALLY
 * returns today (not what the app intends), so the suite stays green as a
 * regression baseline while the gap stays visible and documented rather than
 * silently absorbed.
 */
describe('typed rejection paths conformance', () => {
    it('spend more than the balance', async () => {
        const keyStore = await createConformanceKeyStore()
        const sender = await createAlgo25Account(keyStore)
        const receiver = await createAlgo25Account(keyStore)
        await fundAccount(sender.address, 300_000n)
        await fundAccount(receiver.address, 300_000n)

        const amount = 900_000n
        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
            })
        })
        const signedBytes = await signWithKeystore(keyStore, sender, txn)

        const error = await rejectionOf(() => submitAndConfirm(signedBytes))
        // amount/1000n: algod's debug stringer renders MicroAlgos abbreviated
        // to "mA" (e.g. "900mA" for 900_000 microAlgo); chosen as a multiple
        // of 1000 so this holds without guessing the renderer's rounding.
        expect(error.message).toContain(`overspend (account ${sender.address},`)
        expect(error.message).toContain(`tried to spend ${amount / 1000n}mA)`)

        const algodError = toAlgodError(error)
        // FINDING (PERA-4908): OVERSPEND_RE in parseAlgodMessage.ts requires
        // the legacy "MicroAlgos:{Raw:N}" debug format. algod 5.0.0-stable
        // renders this as "MicroAlgos:299mA" instead, so the regex never
        // matches and a real overspend rejection — the most common rejection
        // in the app — falls through to unknown_node_error instead of the
        // dedicated `overspend` code. See the task report for the fix.
        expect(algodError.code).toBe(AlgodErrorCode.UNKNOWN_NODE_ERROR)
    })

    it('transfer an ASA the receiver has not opted into', async () => {
        const keyStore = await createConformanceKeyStore()
        const creator = await createAlgo25Account(keyStore)
        const receiver = await createAlgo25Account(keyStore)
        await fundAccount(creator.address, 1_000_000n)
        await fundAccount(receiver.address, 300_000n)
        const assetId = await createTestAsset(keyStore, creator, {
            total: 1000n,
        })

        const txn = await buildTxn(composer => {
            composer.addAssetTransfer({
                sender: creator.address,
                receiver: receiver.address,
                assetId,
                amount: 1n,
            })
        })
        const signedBytes = await signWithKeystore(keyStore, creator, txn)

        const error = await rejectionOf(() => submitAndConfirm(signedBytes))
        expect(error.message).toContain(
            `asset ${assetId} missing from ${receiver.address}`,
        )

        const algodError = toAlgodError(error)
        expect(algodError.code).toBe(AlgodErrorCode.MISSING_OPT_IN)
        if (algodError.code !== AlgodErrorCode.MISSING_OPT_IN) {
            throw new Error('unreachable: narrowed by the assertion above')
        }
        expect(algodError.params.assetId).toBe(assetId)
        expect(algodError.params.address).toBe(receiver.address)
    })

    it('sign with the wrong key after a rekey', async () => {
        const keyStore = await createConformanceKeyStore()
        const source = await createAlgo25Account(keyStore)
        const newAuth = await createAlgo25Account(keyStore)
        const receiver = await createAlgo25Account(keyStore)
        await fundAccount(source.address, 1_000_000n)
        await fundAccount(receiver.address, 300_000n)

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
        const authAddr = (
            await getConformanceClient()
                .client.algod.accountInformation(source.address)
                .do()
        ).authAddr?.toString()
        if (authAddr !== newAuth.address) {
            throw new Error(
                `rekey did not land: authAddr is ${authAddr}, expected ${newAuth.address}`,
            )
        }

        const spendTxn = await buildTxn(composer => {
            composer.addPayment({
                sender: source.address,
                receiver: receiver.address,
                amount: microAlgo(1000n),
            })
        })
        // Signed with source's ORIGINAL key, which is no longer the account's
        // auth address post-rekey.
        const signedBytes = await signWithKeystore(keyStore, source, spendTxn)

        const error = await rejectionOf(() => submitAndConfirm(signedBytes))
        expect(error.message).toContain(
            `should have been authorized by ${newAuth.address} but was actually authorized by ${source.address}`,
        )

        const algodError = toAlgodError(error)
        expect(algodError.code).toBe(AlgodErrorCode.NOT_AUTHORIZED)
        if (algodError.code !== AlgodErrorCode.NOT_AUTHORIZED) {
            throw new Error('unreachable: narrowed by the assertion above')
        }
        expect(algodError.params.expectedAuthAddress).toBe(newAuth.address)
        expect(algodError.params.actualAuthAddress).toBe(source.address)
    })

    it('submit a group with a corrupted group id', async () => {
        const keyStore = await createConformanceKeyStore()
        const sender = await createAlgo25Account(keyStore)
        const receiverA = await createAlgo25Account(keyStore)
        const receiverB = await createAlgo25Account(keyStore)
        await fundAccount(sender.address, 1_000_000n)

        const legA = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiverA.address,
                amount: microAlgo(50_000n),
            })
        })
        const legB = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiverB.address,
                amount: microAlgo(60_000n),
            })
        })
        const [g0, g1] = groupTransactions([legA, legB])
        const validGroupId = g0.group!
        // Corrupt AFTER grouping, before signing, so each leg's own signature
        // is still valid over the bytes it signs — the rejection can only be
        // algod's group-hash check, not a bad signature (see groups.spec.ts).
        const corruptedGroupId = crypto.getRandomValues(new Uint8Array(32))
        g1.group = corruptedGroupId

        const signed = [
            await signWithKeystore(keyStore, sender, g0),
            await signWithKeystore(keyStore, sender, g1),
        ]

        const error = await rejectionOf(() => submitAndConfirm(signed))
        expect(error.message).toContain(
            `inconsistent group values: ${encodeBase32NoPad(corruptedGroupId)} != ${encodeBase32NoPad(validGroupId)}`,
        )

        const algodError = toAlgodError(error)
        // FINDING (PERA-4908): no matcher in parseAlgodMessage.ts recognizes
        // "inconsistent group values" (algod's group-hash mismatch text), so
        // this real rejection falls through to unknown_node_error. There is
        // no dedicated AlgodErrorCode for a group-id mismatch today —
        // pinning to the current (only possible) mapping per the brief, and
        // flagging it as a real gap rather than the correct/intended one.
        expect(algodError.code).toBe(AlgodErrorCode.UNKNOWN_NODE_ERROR)
    })

    it('submit with lastValid already in the past', async () => {
        const keyStore = await createConformanceKeyStore()
        const sender = await createAlgo25Account(keyStore)
        const receiver = await createAlgo25Account(keyStore)
        await fundAccount(sender.address, 1_000_000n)
        await fundAccount(receiver.address, 300_000n)

        const { lastRound } = await getConformanceClient()
            .client.algod.status()
            .do()
        // Both comfortably behind the current round, so the window is
        // already closed by the time this reaches the pool. Set via the
        // composer's own params rather than mutating the built Transaction:
        // algosdk types `firstValid`/`lastValid` readonly.
        const firstValid = lastRound - 10n
        const lastValid = lastRound - 5n
        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(1000n),
                firstValidRound: firstValid,
                lastValidRound: lastValid,
            })
        })
        const signedBytes = await signWithKeystore(keyStore, sender, txn)

        const error = await rejectionOf(() => submitAndConfirm(signedBytes))
        expect(error.message).toContain('txn dead:')
        expect(error.message).toContain(
            `outside of ${firstValid}--${lastValid}`,
        )
        expect(txn.firstValid).toBe(firstValid)
        expect(txn.lastValid).toBe(lastValid)

        const algodError = toAlgodError(error)
        // FINDING (PERA-4908): EXPIRED_TXN_RE in parseAlgodMessage.ts expects
        // a single dash between the two round numbers ("outside of A-B").
        // algod 5.0.0-stable's actual message uses a double dash ("outside of
        // A--B", confirmed above), so the regex never matches and this real
        // expired-transaction rejection falls through to unknown_node_error
        // instead of the dedicated `expired_txn` code.
        expect(algodError.code).toBe(AlgodErrorCode.UNKNOWN_NODE_ERROR)
    })
})
