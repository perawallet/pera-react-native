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
} from '../../accounts'
import {
    buildGroup,
    buildTxn,
    createTestAsset,
    signGroupWithKeystore,
    signWithKeystore,
    submitAndConfirm,
    type ConformanceComposer,
} from '../../build'
import { getConformanceClient } from '../../client'
import { createConformanceKeyStore } from '../../keystore'
import { expectConformant } from '../roundTrip'
import type { TxnIntent } from '../intent'

type SubmittedPayment = {
    signedBytes: Uint8Array
    txId: string
    senderBalanceBefore: bigint
}

const NOTE = new TextEncoder().encode('PERA-4908')
const AMOUNT = 250_000n

describe('expectConformant', () => {
    /** One keystore holds every account in this file. */
    let keyStore: Awaited<ReturnType<typeof createConformanceKeyStore>>
    let minFee: bigint
    let senderA: ConformanceAccount
    let senderB: ConformanceAccount
    let senderC: ConformanceAccount
    let senderD: ConformanceAccount
    let receiver: ConformanceAccount
    /** A payment carrying a note. */
    let withNote: SubmittedPayment
    /** A payment carrying no note. Every payment here comes from its own sender
     * so their balance deltas stay independently assertable. */
    let withoutNote: SubmittedPayment
    /** A payment that also hands the sender's account to the receiver. */
    let withRekey: SubmittedPayment
    /** The first leg of a two-payment atomic group. */
    let grouped: SubmittedPayment

    const sendPayment = async (
        sender: ConformanceAccount,
        extra: { note?: Uint8Array; rekeyTo?: string } = {},
    ): Promise<SubmittedPayment> => {
        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(AMOUNT),
                ...extra,
            })
        })
        const signedBytes = await signWithKeystore(keyStore, sender, txn)

        const { balance } = await getConformanceClient().account.getInformation(
            sender.address,
        )
        const { txId } = await submitAndConfirm(signedBytes)

        return { signedBytes, txId, senderBalanceBefore: balance.microAlgo }
    }

    const sendGroup = async (
        sender: ConformanceAccount,
    ): Promise<SubmittedPayment> => {
        const txns = await buildGroup(composer => {
            composer
                .addPayment({
                    sender: sender.address,
                    receiver: receiver.address,
                    amount: microAlgo(AMOUNT),
                })
                // A different amount, because two identical payments in one
                // group share a txID and algod rejects the second as a
                // duplicate.
                .addPayment({
                    sender: sender.address,
                    receiver: receiver.address,
                    amount: microAlgo(AMOUNT + 1n),
                })
        })
        const signed = await signGroupWithKeystore(keyStore, sender, txns)

        const { balance } = await getConformanceClient().account.getInformation(
            sender.address,
        )
        const { txId } = await submitAndConfirm(signed)

        return {
            signedBytes: signed[0],
            txId,
            senderBalanceBefore: balance.microAlgo,
        }
    }

    const baseIntent = (sender: ConformanceAccount): TxnIntent => ({
        type: 'pay',
        sender: sender.address,
        receiver: receiver.address,
        amount: AMOUNT,
        fee: minFee,
        groupSize: 1,
    })

    beforeAll(async () => {
        keyStore = await createConformanceKeyStore()
        senderA = await createAlgo25Account(keyStore)
        senderB = await createAlgo25Account(keyStore)
        senderC = await createAlgo25Account(keyStore)
        senderD = await createAlgo25Account(keyStore)
        receiver = await createAlgo25Account(keyStore)

        await fundAccount(senderA.address, 10_000_000n)
        await fundAccount(senderB.address, 10_000_000n)
        await fundAccount(senderC.address, 10_000_000n)
        await fundAccount(senderD.address, 10_000_000n)

        // The fee expectation comes from the node, never from a constant copied
        // out of app code.
        const params = await getConformanceClient()
            .client.algod.getTransactionParams()
            .do()
        minFee = BigInt(params.minFee)

        withNote = await sendPayment(senderA, { note: NOTE })
        withoutNote = await sendPayment(senderB)
        withRekey = await sendPayment(senderC, { rekeyTo: receiver.address })
        grouped = await sendGroup(senderD)
    })

    it('confirms a real payment that matches its intent', async () => {
        const confirmed = await expectConformant({
            intent: { ...baseIntent(senderA), note: NOTE },
            ...withNote,
        })

        expect(confirmed.confirmedRound).toBeGreaterThan(0n)
        expect(confirmed.txn.txn.txID()).toBe(withNote.txId)
    })

    it('does not assert fields the intent leaves out', async () => {
        // The transaction carries a note; an intent that never mentions one
        // must still pass.
        await expect(
            expectConformant({ intent: baseIntent(senderA), ...withNote }),
        ).resolves.toBeDefined()
    })

    it('rejects a wrong amount, naming both values', async () => {
        const wrong = expectConformant({
            intent: { ...baseIntent(senderA), amount: AMOUNT + 1n },
            ...withNote,
        })

        await expect(wrong).rejects.toThrow(/amount/)
        await expect(wrong).rejects.toThrow(new RegExp(String(AMOUNT + 1n)))
        await expect(wrong).rejects.toThrow(new RegExp(String(AMOUNT)))
    })

    it('rejects a wrong receiver', async () => {
        const wrong = expectConformant({
            intent: { ...baseIntent(senderA), receiver: senderB.address },
            ...withNote,
        })

        await expect(wrong).rejects.toThrow(/receiver/)
        await expect(wrong).rejects.toThrow(new RegExp(receiver.address))
    })

    it('rejects a note the transaction does not carry', async () => {
        const wrong = expectConformant({
            intent: { ...baseIntent(senderB), note: NOTE },
            ...withoutNote,
        })

        await expect(wrong).rejects.toThrow(/note/)
        await expect(wrong).rejects.toThrow(/\(unset\)/)
    })

    // The node accepts and confirms this transaction: it is wrong, not invalid.
    // Silence about `rekeyTo` in the intent must not be read as consent.
    it('rejects a rekey the intent never declared', async () => {
        const wrong = expectConformant({
            intent: baseIntent(senderC),
            ...withRekey,
        })

        await expect(wrong).rejects.toThrow(/rekeyTo/)
        await expect(wrong).rejects.toThrow(new RegExp(receiver.address))
    })

    it('accepts the same rekey once the intent declares it', async () => {
        await expect(
            expectConformant({
                intent: {
                    ...baseIntent(senderC),
                    rekeyTo: receiver.address,
                },
                ...withRekey,
            }),
        ).resolves.toBeDefined()
    })

    // Grouping suppresses the balance assertion, so it may not be discovered
    // silently — the intent has to say the transaction is grouped.
    it('rejects a grouped transaction whose intent never declared a group', async () => {
        await expect(
            expectConformant({
                intent: { ...baseIntent(senderD), groupSize: undefined },
                ...grouped,
            }),
        ).rejects.toThrow(/carries a group id/)
    })

    it('accepts a grouped transaction once the intent declares the group', async () => {
        await expect(
            expectConformant({
                intent: { ...baseIntent(senderD), groupSize: 2 },
                signedBytes: grouped.signedBytes,
                txId: grouped.txId,
            }),
        ).resolves.toBeDefined()
    })

    // A grouped leg gets no balance assertion (see expectedBalanceDelta), so a
    // senderBalanceBefore on it is a value nothing reads — reject it rather
    // than silently ignore it.
    it('rejects senderBalanceBefore declared alongside a group', async () => {
        await expect(
            expectConformant({
                intent: { ...baseIntent(senderD), groupSize: 2 },
                ...grouped,
            }),
        ).rejects.toThrow(/senderBalanceBefore/)
    })

    it('rejects a single transaction declared as part of a group', async () => {
        await expect(
            expectConformant({
                intent: { ...baseIntent(senderA), groupSize: 2 },
                signedBytes: withNote.signedBytes,
                txId: withNote.txId,
            }),
        ).rejects.toThrow(/isGrouped/)
    })

    it('rejects a fee other than the one the chain charged', async () => {
        const wrong = expectConformant({
            intent: { ...baseIntent(senderA), fee: minFee + 1n },
            ...withNote,
        })

        await expect(wrong).rejects.toThrow(/fee/)
        await expect(wrong).rejects.toThrow(new RegExp(String(minFee + 1n)))
    })

    it('rejects a balance that did not move by the confirmed amount and fee', async () => {
        await expect(
            expectConformant({
                intent: baseIntent(senderA),
                ...withNote,
                senderBalanceBefore: withNote.senderBalanceBefore + 1n,
            }),
        ).rejects.toThrow(/sender balance moved by/)
    })

    it('rejects an ungrouped transaction with no senderBalanceBefore declared', async () => {
        await expect(
            expectConformant({
                intent: baseIntent(senderA),
                signedBytes: withNote.signedBytes,
                txId: withNote.txId,
            }),
        ).rejects.toThrow(/senderBalanceBefore is required/)
    })

    it('rejects bytes that are not the transaction being asserted', async () => {
        await expect(
            expectConformant({
                intent: baseIntent(senderA),
                ...withNote,
                signedBytes: withoutNote.signedBytes,
            }),
        ).rejects.toThrow(/not the transaction being asserted/)
    })
})

/**
 * The clawback seizure is the sharpest form of the premise this suite exists
 * for: the node accepts and confirms it, every field a naive intent declares
 * matches, and it takes a third party's asset units anyway.
 */
describe('expectConformant — asset clawback', () => {
    let keyStore: Awaited<ReturnType<typeof createConformanceKeyStore>>
    let minFee: bigint
    let assetId: bigint
    let clawbackAuthority: ConformanceAccount
    let victim: ConformanceAccount
    let seizure: SubmittedPayment

    const SEIZED = 100n

    const sendAsset = async (
        sender: ConformanceAccount,
        compose: (composer: ConformanceComposer) => void,
    ): Promise<SubmittedPayment> => {
        const txn = await buildTxn(compose)
        const signedBytes = await signWithKeystore(keyStore, sender, txn)
        const { balance } = await getConformanceClient().account.getInformation(
            sender.address,
        )
        const { txId } = await submitAndConfirm(signedBytes)
        return { signedBytes, txId, senderBalanceBefore: balance.microAlgo }
    }

    beforeAll(async () => {
        keyStore = await createConformanceKeyStore()
        clawbackAuthority = await createAlgo25Account(keyStore)
        victim = await createAlgo25Account(keyStore)

        await fundAccount(clawbackAuthority.address, 10_000_000n)
        await fundAccount(victim.address, 10_000_000n)

        const params = await getConformanceClient()
            .client.algod.getTransactionParams()
            .do()
        minFee = BigInt(params.minFee)

        assetId = await createTestAsset(keyStore, clawbackAuthority, {
            total: 1000n,
            clawback: clawbackAuthority.address,
        })

        await sendAsset(victim, composer => {
            composer.addAssetOptIn({ sender: victim.address, assetId })
        })
        await sendAsset(clawbackAuthority, composer => {
            composer.addAssetTransfer({
                sender: clawbackAuthority.address,
                receiver: victim.address,
                assetId,
                amount: SEIZED,
            })
        })

        seizure = await sendAsset(clawbackAuthority, composer => {
            composer.addAssetTransfer({
                sender: clawbackAuthority.address,
                receiver: clawbackAuthority.address,
                assetId,
                amount: SEIZED,
                clawbackTarget: victim.address,
            })
        })
    })

    const seizureIntent = (): TxnIntent => ({
        type: 'axfer',
        sender: clawbackAuthority.address,
        receiver: clawbackAuthority.address,
        amount: SEIZED,
        assetId,
        fee: minFee,
        groupSize: 1,
    })

    it('really did take the units, so the transaction is wrong and not invalid', async () => {
        const holding =
            await getConformanceClient().asset.getAccountInformation(
                victim.address,
                assetId,
            )

        expect(holding.balance).toBe(0n)
    })

    it('rejects a seizure the intent never declared', async () => {
        const wrong = expectConformant({ intent: seizureIntent(), ...seizure })

        await expect(wrong).rejects.toThrow(/assetSender/)
        await expect(wrong).rejects.toThrow(new RegExp(victim.address))
    })

    it('accepts the same seizure once the intent declares assetSender', async () => {
        await expect(
            expectConformant({
                intent: { ...seizureIntent(), assetSender: victim.address },
                ...seizure,
            }),
        ).resolves.toBeDefined()
    })
})
