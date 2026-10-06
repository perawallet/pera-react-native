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

import { FALLBACK_ASSET_MBR } from '@perawallet/wallet-core-chain-algorand/blockchain/constants'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { buildExpressTransferTxs } from '@perawallet/wallet-core-chain-algorand/transactions/builders'

import {
    createAlgo25Account,
    fundAccount,
    type ConformanceAccount,
} from '../../harness/accounts'
import { expectConformant } from '../../harness/assert/roundTrip'
import {
    createTestAsset,
    signWithKeystore,
    submitAndConfirm,
} from '../../harness/build'
import {
    accountInformationOf,
    balanceOf,
    getConformanceClient,
} from '../../harness/client'
import {
    createConformanceKeyStore,
    type ConformanceKeyStore,
} from '../../harness/keystore'
import { localNetScope } from '../../harness/scope'

/**
 * Express send funds a receiver that cannot yet hold the asset, has it opt in,
 * and transfers, as one group signed by two parties. Only a real node proves
 * the funding covers the receiver's post-opt-in MBR plus its own opt-in fee:
 * short by a microAlgo and the whole group is rejected.
 *
 * The funding arithmetic is `useTransactionSendFlow`'s and is repeated here on
 * the same app fetch + mapper pair the hook reads the receiver through.
 */
describe('express send construction conformance', () => {
    let scope: ChainScope
    /** µAlgo; what an Ed25519 party's fee resolves to, so no fee is pinned. */
    let baseMinFee: bigint
    let keyStore: ConformanceKeyStore
    let sender: ConformanceAccount
    let assetId: bigint

    const expressFundingFor = async (receiver: string): Promise<bigint> => {
        const { amount, minBalance } = await accountInformationOf(receiver)
        const balanceNeeded = minBalance + FALLBACK_ASSET_MBR + baseMinFee
        return balanceNeeded > amount ? balanceNeeded - amount : 0n
    }

    const holdingOf = async (address: string): Promise<bigint | undefined> =>
        (await accountInformationOf(address)).assets.find(
            asset => asset.assetId === assetId,
        )?.amount

    beforeAll(async () => {
        scope = await localNetScope()
        const { minFee } = await getConformanceClient()
            .client.algod.getTransactionParams()
            .do()
        baseMinFee = BigInt(minFee)
        keyStore = await createConformanceKeyStore()
        sender = await createAlgo25Account(keyStore)
        await fundAccount(sender.address, 10_000_000n)
        assetId = await createTestAsset(keyStore, sender, {
            total: 1000n,
            unitName: 'EXPR',
        })
    })

    it('funds, opts in and pays a receiver that has never been on chain', async () => {
        const receiver = await createAlgo25Account(keyStore)
        const amount = 25n
        const funding = await expressFundingFor(receiver.address)
        expect(funding).toBeGreaterThan(0n)
        const senderBalanceBefore = await balanceOf(sender.address)

        const txns = await buildExpressTransferTxs({
            scope,
            sender: sender.address,
            receiver: receiver.address,
            assetId,
            amount,
            funding,
        })
        expect(txns).toHaveLength(3)
        const [fund, optIn, transfer] = txns

        const signed = [
            await signWithKeystore(keyStore, sender, fund),
            await signWithKeystore(keyStore, receiver, optIn),
            await signWithKeystore(keyStore, sender, transfer),
        ]
        const { txIds } = await submitAndConfirm(signed)

        const groupSize = 3
        await expectConformant({
            intent: {
                type: 'pay',
                sender: sender.address,
                receiver: receiver.address,
                amount: funding,
                fee: fund.fee,
                groupSize,
            },
            signedBytes: signed[0],
            txId: txIds[0],
        })
        await expectConformant({
            intent: {
                type: 'axfer',
                sender: receiver.address,
                receiver: receiver.address,
                assetId,
                amount: 0n,
                fee: optIn.fee,
                groupSize,
            },
            signedBytes: signed[1],
            txId: txIds[1],
        })
        await expectConformant({
            intent: {
                type: 'axfer',
                sender: sender.address,
                receiver: receiver.address,
                assetId,
                amount,
                fee: transfer.fee,
                groupSize,
            },
            signedBytes: signed[2],
            txId: txIds[2],
        })

        expect(await holdingOf(receiver.address)).toBe(amount)
        expect(await balanceOf(sender.address)).toBe(
            senderBalanceBefore - funding - fund.fee - transfer.fee,
        )
        // Funded to the microAlgo: the receiver is left holding exactly its
        // new minimum balance.
        const receiverInfo = await accountInformationOf(receiver.address)
        expect(receiverInfo.amount).toBe(funding - optIn.fee)
        expect(receiverInfo.amount).toBe(receiverInfo.minBalance)
    })

    it('drops the funding leg when the receiver can already afford the opt-in', async () => {
        const receiver = await createAlgo25Account(keyStore)
        await fundAccount(receiver.address, 1_000_000n)
        const amount = 30n
        const funding = await expressFundingFor(receiver.address)
        expect(funding).toBe(0n)
        const receiverBalanceBefore = await balanceOf(receiver.address)

        const txns = await buildExpressTransferTxs({
            scope,
            sender: sender.address,
            receiver: receiver.address,
            assetId,
            amount,
            funding,
        })
        expect(txns).toHaveLength(2)
        const [optIn, transfer] = txns

        const signed = [
            await signWithKeystore(keyStore, receiver, optIn),
            await signWithKeystore(keyStore, sender, transfer),
        ]
        const { txIds } = await submitAndConfirm(signed)

        await expectConformant({
            intent: {
                type: 'axfer',
                sender: receiver.address,
                receiver: receiver.address,
                assetId,
                amount: 0n,
                fee: optIn.fee,
                groupSize: 2,
            },
            signedBytes: signed[0],
            txId: txIds[0],
        })
        await expectConformant({
            intent: {
                type: 'axfer',
                sender: sender.address,
                receiver: receiver.address,
                assetId,
                amount,
                fee: transfer.fee,
                groupSize: 2,
            },
            signedBytes: signed[1],
            txId: txIds[1],
        })

        expect(await holdingOf(receiver.address)).toBe(amount)
        expect(await balanceOf(receiver.address)).toBe(
            receiverBalanceBefore - optIn.fee,
        )
    })
})
