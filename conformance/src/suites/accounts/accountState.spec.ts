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

import { Decimal } from 'decimal.js'
import { beforeAll, describe, expect, it } from 'vitest'

import { fetchAccountAssetOptInRounds } from '@perawallet/wallet-core-accounts/hooks/endpoints'
import {
    FALLBACK_ASSET_MBR,
    FALLBACK_BASE_ACCOUNT_MBR,
} from '@perawallet/wallet-core-blockchain/constants'
import {
    baseUnitsToDisplayUnits,
    microAlgosToAlgos,
} from '@perawallet/wallet-core-blockchain/utils'

import {
    createAlgo25Account,
    fundAccount,
    type ConformanceAccount,
} from '../../harness/accounts'
import {
    buildTxn,
    createTestAsset,
    signWithKeystore,
    submitAndConfirm,
} from '../../harness/build'
import {
    accountInformationOf,
    getConformanceClient,
} from '../../harness/client'
import {
    createConformanceKeyStore,
    type ConformanceKeyStore,
} from '../../harness/keystore'

/**
 * Every balance the app shows starts as an algod response and becomes an
 * `AccountInformation` through `mapOnChainAccountInformation`. Its own tests
 * feed it hand-written objects; nothing checks it against a response a node
 * actually produced, or that the `bigint` fields survive the trip (a `number`
 * leaking in is silent until a balance passes 2^53).
 *
 * These tests read real accounts through the app's own fetch + transform pair
 * and compare against values the suite itself caused.
 */
describe('account state conformance', () => {
    let keyStore: ConformanceKeyStore
    let holder: ConformanceAccount
    let assetId: bigint

    beforeAll(async () => {
        keyStore = await createConformanceKeyStore()
        holder = await createAlgo25Account(keyStore)
        await fundAccount(holder.address, 10_000_000n)
        assetId = await createTestAsset(keyStore, holder, {
            total: 500_000n,
            decimals: 3,
            unitName: 'STATE',
        })
    })

    it('reports the funded balance and the base MBR the constants declare', async () => {
        const fresh = await createAlgo25Account(keyStore)
        await fundAccount(fresh.address, 3_000_000n)

        const info = await accountInformationOf(fresh.address)

        expect(info.amount).toBe(3_000_000n)
        expect(typeof info.amount).toBe('bigint')
        // A brand-new account holding nothing owes exactly the base MBR — the
        // constant the app falls back to when remote config is unavailable.
        expect(info.minBalance).toBe(FALLBACK_BASE_ACCOUNT_MBR)
        expect(info.assets).toEqual([])
        expect(info.authAddress).toBeUndefined()
    })

    it('raises the reported MBR by exactly one asset MBR after an opt-in', async () => {
        const opter = await createAlgo25Account(keyStore)
        await fundAccount(opter.address, 1_000_000n)

        const before = await accountInformationOf(opter.address)

        const optIn = await buildTxn(composer => {
            composer.addAssetOptIn({ sender: opter.address, assetId })
        })
        await submitAndConfirm(await signWithKeystore(keyStore, opter, optIn))

        const after = await accountInformationOf(opter.address)

        // The chain adjudicates the arithmetic the app's send flow performs
        // locally (`currentMbr + assetMbr`) before it lets a user spend.
        expect(after.minBalance - before.minBalance).toBe(FALLBACK_ASSET_MBR)
        expect(after.assets).toEqual([{ assetId, amount: 0n, isFrozen: false }])
    })

    it('carries an asset holding through the transform at base-unit fidelity', async () => {
        const receiver = await createAlgo25Account(keyStore)
        await fundAccount(receiver.address, 1_000_000n)

        const optIn = await buildTxn(composer => {
            composer.addAssetOptIn({ sender: receiver.address, assetId })
        })
        await submitAndConfirm(
            await signWithKeystore(keyStore, receiver, optIn),
        )

        const amount = 12_345n
        const transfer = await buildTxn(composer => {
            composer.addAssetTransfer({
                sender: holder.address,
                receiver: receiver.address,
                assetId,
                amount,
            })
        })
        await submitAndConfirm(
            await signWithKeystore(keyStore, holder, transfer),
        )

        const info = await accountInformationOf(receiver.address)
        const holding = info.assets.find(asset => asset.assetId === assetId)

        expect(holding?.amount).toBe(amount)
        // Base units in, display units out, through the app's own conversion —
        // the asset was created with 3 decimals, so 12_345 base units is
        // 12.345 whole units and nothing else.
        expect(
            baseUnitsToDisplayUnits(new Decimal(holding!.amount.toString()), 3),
        ).toEqual(new Decimal('12.345'))
        expect(microAlgosToAlgos(new Decimal(info.amount.toString()))).toEqual(
            new Decimal(info.amount.toString()).div(1_000_000),
        )
    })

    it('reports the opt-in round the indexer recorded', async () => {
        const opter = await createAlgo25Account(keyStore)
        await fundAccount(opter.address, 1_000_000n)

        const optIn = await buildTxn(composer => {
            composer.addAssetOptIn({ sender: opter.address, assetId })
        })
        const { confirmed } = await submitAndConfirm(
            await signWithKeystore(keyStore, opter, optIn),
        )

        // The indexer is the only source that exposes an opt-in round, and the
        // app reads it through this function for the asset-detail screen.
        // Poll: the indexer trails algod by a round or two.
        let rounds = new Map<string, number>()
        for (let attempt = 0; attempt < 30; attempt++) {
            rounds = await fetchAccountAssetOptInRounds(
                getConformanceClient(),
                opter.address,
            )
            if (rounds.has(assetId.toString())) break
            await new Promise(resolve => setTimeout(resolve, 500))
        }

        expect(rounds.get(assetId.toString())).toBe(
            Number(confirmed.confirmedRound),
        )
    })
})
