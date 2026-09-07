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
    isAlgodError,
    toAlgodError,
} from '@perawallet/wallet-core-blockchain/errors'
import { groupTransactions } from '@perawallet/wallet-core-blockchain/utils/transact'

import { createAlgo25Account, fundAccount } from '../../harness/accounts'
import { base32Encode } from '../../harness/base32'
import {
    buildTxn,
    createTestAsset,
    signWithKeystore,
    submitAndConfirm,
} from '../../harness/build'
import { getConformanceClient } from '../../harness/client'
import { createConformanceKeyStore } from '../../harness/keystore'

const rejectionOf = async (submit: () => Promise<unknown>): Promise<Error> => {
    try {
        await submit()
    } catch (error) {
        return error as Error
    }
    throw new Error('expected the submission to be rejected, but it landed')
}

/**
 * Asserts the app's TYPED `AlgodErrorCode` for six real algod rejections,
 * never a raw node string. Each case creates its own accounts so a filtered
 * `-t` run exercises the same setup a full run would.
 *
 * This suite originally found that THREE of the first five (`overspend`,
 * `expired lastValid`, `corrupted group id`) mapped to `unknown_node_error`
 * instead of their intended codes — a real gap between `parseAlgodMessage.ts`'s
 * regexes and algod 5.0.0-stable's actual wording, which additionally routed
 * each one through `submitAndAutoRefreshCore`'s unknown-outcome verification
 * retry loop instead of surfacing immediately
 * (`classifySubmitFailure.ts`'s `NO_NODE_VERDICT_CODES`). `overspend` and
 * `expired lastValid` are fixed in this PR (see their FINDING comments below
 * for what changed); `corrupted group id` remains an open finding — see its
 * comment for why no fix was made here.
 *
 * The sixth case (`below_min_balance`) was added after a one-off manual
 * probe confirmed it was NOT affected by the same drift — this case is the
 * suite catching that class of regression going forward instead of relying
 * on a human to re-probe it.
 */
describe('typed rejection paths conformance', () => {
    it('spend more than the balance', async () => {
        const keyStore = await createConformanceKeyStore()
        const sender = await createAlgo25Account(keyStore)
        const receiver = await createAlgo25Account(keyStore)
        // funded chosen so funded-fee lands on a round milliAlgo figure (see
        // the renderedBalance guard below) — algod's overspend message
        // renders the account's balance MINUS the rejected transaction's own
        // fee (confirmed empirically against LocalNet), abbreviated to a
        // unit-suffixed figure ("300mA", not "300000" or "{Raw:300000}").
        const funded = 301_000n
        await fundAccount(sender.address, funded)
        await fundAccount(receiver.address, 300_000n)

        const amount = 900_000n
        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
            })
        })
        const renderedBalance = funded - txn.fee
        if (renderedBalance % 1000n !== 0n) {
            throw new Error(
                `funded (${funded}) minus fee (${txn.fee}) is ${renderedBalance}, not a round milliAlgo figure — the "${renderedBalance}mA" assertion below assumes no decimal part`,
            )
        }
        const signedBytes = await signWithKeystore(keyStore, sender, txn)

        const error = await rejectionOf(() => submitAndConfirm(signedBytes))
        // amount/1000n: algod's debug stringer renders MicroAlgos abbreviated
        // to "mA" (e.g. "900mA" for 900_000 microAlgo); chosen as a multiple
        // of 1000 so this holds without guessing the renderer's rounding.
        expect(error.message).toContain(`overspend (account ${sender.address},`)
        // Guards the exact rendering OVERSPEND_RE's shape-match relies on —
        // this string previously lived only in a comment, not an assertion.
        expect(error.message).toContain(
            `MicroAlgos:${renderedBalance / 1000n}mA`,
        )
        expect(error.message).toContain(`tried to spend ${amount / 1000n}mA)`)

        const algodError = toAlgodError(error)
        // Was a FINDING : OVERSPEND_RE
        // required the legacy "MicroAlgos:{Raw:N}" debug format. algod
        // 5.0.0-stable renders this as a unit-suffixed figure instead
        // ("MicroAlgos:300mA"), so the regex never matched and a real
        // overspend rejection — the most common rejection in the app —
        // fell through to unknown_node_error, which additionally routed it
        // into submitAndAutoRefreshCore's unknown-outcome verification retry
        // loop instead of surfacing immediately (classifySubmitFailure.ts's
        // NO_NODE_VERDICT_CODES). Fixed in this PR by matching on message
        // shape instead of the numeric rendering; the balance/spent/missing
        // params are no longer populated (see algodErrorCodes.ts).
        expect(algodError.code).toBe(AlgodErrorCode.OVERSPEND)
        // `code !== X` narrows the literal `code` type but not the generic
        // `AlgodError<C>` itself, so `params` stays the full union — the
        // exported type-guard narrows the instance's `C` instead.
        if (!isAlgodError(algodError, AlgodErrorCode.OVERSPEND)) {
            throw new Error(
                'unreachable: the if above already narrows the type',
            )
        }
        // `address` is now the only field `matchOverspend` extracts — assert
        // it against a real rejection, not just synthetic fixtures.
        expect(algodError.params.address).toBe(sender.address)
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
        if (!isAlgodError(algodError, AlgodErrorCode.MISSING_OPT_IN)) {
            throw new Error(
                'unreachable: the if above already narrows the type',
            )
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
        if (!isAlgodError(algodError, AlgodErrorCode.NOT_AUTHORIZED)) {
            throw new Error(
                'unreachable: the if above already narrows the type',
            )
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
            `inconsistent group values: ${base32Encode(corruptedGroupId)} != ${base32Encode(validGroupId)}`,
        )

        const algodError = toAlgodError(error)
        // FINDING, STILL OPEN — recorded as a follow-up, not
        // fixed in this PR: no matcher in parseAlgodMessage.ts recognizes
        // "inconsistent group values" (algod's group-hash mismatch text), so
        // this real rejection falls through to unknown_node_error. There is
        // no dedicated AlgodErrorCode for a group-id mismatch today, and one
        // is deliberately NOT invented here — the fix for overspend/expired
        // above was to correct an existing code's matcher, not to grow the
        // enum. This is not benign: unknown_node_error is one of
        // classifySubmitFailure.ts's NO_NODE_VERDICT_CODES, so a corrupted
        // group id also routes through the pointless unknown-outcome
        // verification retry before surfacing (same mechanism as the
        // overspend/expired bug). In practice this needs a hand-corrupted
        // group id to trigger, which normal signing flows cannot produce.
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
        // A just-started LocalNet can be at a very low round; guard against
        // firstValid/lastValid underflowing to a negative bigint, which would
        // build a nonsensical (and differently-rejected) transaction instead
        // of the expired one this case means to exercise.
        if (lastRound <= 10n) {
            throw new Error(
                `LocalNet is at round ${lastRound}, too early to construct an already-expired validity window (need > round 10)`,
            )
        }
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
        // Was a FINDING : EXPIRED_TXN_RE
        // required a single dash between the two round numbers ("outside of
        // A-B"). algod 5.0.0-stable's actual message uses a double dash
        // ("outside of A--B", asserted above), so the regex never matched
        // and this real expired-transaction rejection fell through to
        // unknown_node_error — which, like the overspend case, additionally
        // routed it into the unknown-outcome verification retry loop instead
        // of surfacing immediately. Fixed in this PR: the regex now accepts
        // both renderings.
        expect(algodError.code).toBe(AlgodErrorCode.EXPIRED_TXN)
        if (!isAlgodError(algodError, AlgodErrorCode.EXPIRED_TXN)) {
            throw new Error(
                'unreachable: the if above already narrows the type',
            )
        }
        expect(algodError.params.lastValid).toBe(lastValid)
    })

    it('spend that would leave the account below its (asset-raised) minimum balance', async () => {
        const keyStore = await createConformanceKeyStore()
        const creator = await createAlgo25Account(keyStore)
        const holder = await createAlgo25Account(keyStore)
        const receiver = await createAlgo25Account(keyStore)
        await fundAccount(creator.address, 1_000_000n)
        // Comfortably above base MBR + asset MBR + the payment below, so
        // opting in and the payment itself both succeed — only the payment's
        // effect on the post-opt-in floor should trigger the rejection.
        await fundAccount(holder.address, 260_000n)
        await fundAccount(receiver.address, 300_000n)
        const assetId = await createTestAsset(keyStore, creator, {
            total: 1000n,
        })

        const optInTxn = await buildTxn(composer => {
            composer.addAssetOptIn({ sender: holder.address, assetId })
        })
        await submitAndConfirm(
            await signWithKeystore(keyStore, holder, optInTxn),
        )

        // Ground truth from algod, not computed from the funded amount: the
        // opted-in asset has already raised holder's required minimum, and
        // this is the exact floor/balance pair `matchBelowMinBalance` reads
        // off the rejection message below.
        const algod = getConformanceClient().client.algod
        const postOptIn = await algod.accountInformation(holder.address).do()
        const requiredMinBalance = postOptIn.minBalance
        const balanceAfterOptIn = postOptIn.amount
        if (balanceAfterOptIn <= requiredMinBalance) {
            throw new Error(
                `holder's balance (${balanceAfterOptIn}) is not above its post-opt-in minimum (${requiredMinBalance}) — funded too little for this case to isolate below_min_balance from overspend`,
            )
        }

        // Overshoot the gap between current balance and the floor so the
        // resulting balance lands comfortably below it regardless of the
        // exact fee charged, while staying well short of the total balance
        // (so this is below_min_balance, not overspend).
        const overshoot = 50_000n
        const amount = balanceAfterOptIn - requiredMinBalance + overshoot
        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: holder.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
            })
        })
        const renderedBalance = balanceAfterOptIn - amount - txn.fee
        if (renderedBalance < 0n || renderedBalance >= requiredMinBalance) {
            throw new Error(
                `renderedBalance (${renderedBalance}) is not a valid below-min case relative to requiredMinBalance (${requiredMinBalance}) — adjust amount/overshoot`,
            )
        }
        const signedBytes = await signWithKeystore(keyStore, holder, txn)

        const error = await rejectionOf(() => submitAndConfirm(signedBytes))
        expect(error.message).toContain(
            `account ${holder.address} balance ${renderedBalance} below min ${requiredMinBalance} (1 assets)`,
        )

        const algodError = toAlgodError(error)
        expect(algodError.code).toBe(AlgodErrorCode.BELOW_MIN_BALANCE)
        if (!isAlgodError(algodError, AlgodErrorCode.BELOW_MIN_BALANCE)) {
            throw new Error(
                'unreachable: the if above already narrows the type',
            )
        }
        expect(algodError.params.address).toBe(holder.address)
        expect(algodError.params.balance).toBe(renderedBalance)
        expect(algodError.params.required).toBe(requiredMinBalance)
        expect(algodError.params.assetCount).toBe(1)
    })
})
