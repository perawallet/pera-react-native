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
    createTestAsset,
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

const holdingOf = async (
    address: string,
    assetId: bigint,
): Promise<bigint | undefined> => {
    const info = await getConformanceClient()
        .client.algod.accountInformation(address)
        .do()
    return info.assets?.find(asset => asset.assetId === assetId)?.amount
}

// The units the 'transfers' case sends the holder, and the exact amount the
// 'opts out' case asserts before it sweeps — not just presence. These three
// cases run as a chain against one holder (opt-in, transfer, opt-out), and a
// filtered `-t` run that skips 'transfers' would otherwise leave the holder's
// balance at its post-opt-in 0n, which a mere `!== undefined` guard would
// accept and then assert vacuously true (0n === 0n) on both sides of the
// close-out. Pinning the expected value turns that into a loud failure.
const TRANSFER_AMOUNT = 400n

describe('asset transfer construction conformance', () => {
    let keyStore: ConformanceKeyStore
    let creator: ConformanceAccount
    let holder: ConformanceAccount
    let assetId: bigint

    beforeAll(async () => {
        keyStore = await createConformanceKeyStore()
        creator = await createAlgo25Account(keyStore)
        holder = await createAlgo25Account(keyStore)
        await fundAccount(creator.address, 10_000_000n)
        await fundAccount(holder.address, 10_000_000n)

        assetId = await createTestAsset(keyStore, creator, {
            total: 1000n,
            decimals: 0,
            unitName: 'CONF',
            assetName: 'conformance asset',
        })
    })

    it('opts in: the holding appears with a zero balance', async () => {
        expect(await holdingOf(holder.address, assetId)).toBeUndefined()

        const senderBalanceBefore = await balanceOf(holder.address)
        const txn = await buildTxn(composer => {
            composer.addAssetOptIn({ sender: holder.address, assetId })
        })
        const signedBytes = await signWithKeystore(keyStore, holder, txn)
        const { txId } = await submitAndConfirm(signedBytes)

        const intent: TxnIntent = {
            type: 'axfer',
            sender: holder.address,
            receiver: holder.address,
            assetId,
            amount: 0n,
            fee: txn.fee,
        }

        await expectConformant({
            intent,
            signedBytes,
            txId,
            senderBalanceBefore,
        })
        expect(await holdingOf(holder.address, assetId)).toBe(0n)
    })

    it('transfers units from the creator to the opted-in holder', async () => {
        const amount = TRANSFER_AMOUNT
        const senderBalanceBefore = await balanceOf(creator.address)

        const txn = await buildTxn(composer => {
            composer.addAssetTransfer({
                sender: creator.address,
                receiver: holder.address,
                assetId,
                amount,
            })
        })
        const signedBytes = await signWithKeystore(keyStore, creator, txn)
        const { txId } = await submitAndConfirm(signedBytes)

        const intent: TxnIntent = {
            type: 'axfer',
            sender: creator.address,
            receiver: holder.address,
            assetId,
            amount,
            fee: txn.fee,
        }

        await expectConformant({
            intent,
            signedBytes,
            txId,
            senderBalanceBefore,
        })
        expect(await holdingOf(holder.address, assetId)).toBe(amount)
    })

    it('opts out: the holding disappears and remaining units close to the creator', async () => {
        const remaining = await holdingOf(holder.address, assetId)
        if (remaining !== TRANSFER_AMOUNT) {
            throw new Error(
                `holder's holding is ${remaining}, expected the ${TRANSFER_AMOUNT} the 'transfers' case establishes — run the whole file, not a filtered subset`,
            )
        }
        const creatorHoldingBefore = await holdingOf(creator.address, assetId)
        if (creatorHoldingBefore === undefined) {
            throw new Error('creator has no holding to receive the close-out')
        }
        const senderBalanceBefore = await balanceOf(holder.address)

        const txn = await buildTxn(composer => {
            composer.addAssetTransfer({
                sender: holder.address,
                receiver: holder.address,
                assetId,
                amount: 0n,
                closeAssetTo: creator.address,
            })
        })
        const signedBytes = await signWithKeystore(keyStore, holder, txn)
        const { txId } = await submitAndConfirm(signedBytes)

        const intent: TxnIntent = {
            type: 'axfer',
            sender: holder.address,
            receiver: holder.address,
            assetId,
            amount: 0n,
            assetCloseTo: creator.address,
            fee: txn.fee,
        }

        await expectConformant({
            intent,
            signedBytes,
            txId,
            senderBalanceBefore,
        })
        expect(await holdingOf(holder.address, assetId)).toBeUndefined()
        expect(await holdingOf(creator.address, assetId)).toBe(
            creatorHoldingBefore + remaining,
        )
    })
})
