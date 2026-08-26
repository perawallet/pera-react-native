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
    createQuantumAccount,
    fundAccount,
    type ConformanceAccount,
} from '../accounts'
import {
    buildGroup,
    buildTxn,
    createTestAsset,
    signGroupWithKeystore,
    signWithKeystore,
    submitAndConfirm,
} from '../build'
import { getConformanceClient } from '../client'
import { createConformanceKeyStore } from '../keystore'

describe('conformance transaction builder', () => {
    let keyStore: Awaited<ReturnType<typeof createConformanceKeyStore>>
    let account: ConformanceAccount
    let receiver: ConformanceAccount

    beforeAll(async () => {
        keyStore = await createConformanceKeyStore()
        account = await createAlgo25Account(keyStore)
        receiver = await createAlgo25Account(keyStore)
        await fundAccount(account.address, 10_000_000n)
    })

    it('creates an asset the creator holds in full', async () => {
        const assetId = await createTestAsset(keyStore, account, {
            total: 42_000n,
            decimals: 2,
            unitName: 'PERA',
            assetName: 'conformance',
        })

        const asset = await getConformanceClient().asset.getById(assetId)
        expect(asset.creator).toBe(account.address)
        expect(asset.total).toBe(42_000n)
        expect(asset.decimals).toBe(2)
    })

    it('assigns a group id to a multi-transaction group and none to a single one', async () => {
        const group = await buildGroup(composer => {
            composer
                .addPayment({
                    sender: account.address,
                    receiver: receiver.address,
                    amount: microAlgo(100_000n),
                })
                .addPayment({
                    sender: account.address,
                    receiver: receiver.address,
                    amount: microAlgo(100_000n),
                })
        })
        expect(group).toHaveLength(2)
        expect(group[0].group).toEqual(group[1].group)

        const single = await buildTxn(composer => {
            composer.addPayment({
                sender: account.address,
                receiver: receiver.address,
                amount: microAlgo(100_000n),
            })
        })
        expect(single.group).toBeUndefined()
    })

    it('submits a keystore-signed group as one atomic unit', async () => {
        const group = await buildGroup(composer => {
            composer
                .addPayment({
                    sender: account.address,
                    receiver: receiver.address,
                    amount: microAlgo(100_000n),
                })
                .addPayment({
                    sender: account.address,
                    receiver: receiver.address,
                    amount: microAlgo(200_000n),
                })
        })

        const { txIds } = await submitAndConfirm(
            await signGroupWithKeystore(keyStore, account, group),
        )

        expect(txIds).toEqual(group.map(txn => txn.txID()))
    })

    it('signs a quantum account into a pqsig envelope rather than sig', async () => {
        const quantum = await createQuantumAccount(keyStore)
        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: quantum.address,
                receiver: receiver.address,
                amount: microAlgo(100_000n),
            })
        })

        const signed = algosdk.decodeSignedTransaction(
            await signWithKeystore(keyStore, quantum, txn),
        )

        expect(signed.sig).toBeUndefined()
        expect(signed.pqsig?.pk?.[0]).toBe(10)
        expect(signed.sgnr).toBeUndefined()
    })
})
