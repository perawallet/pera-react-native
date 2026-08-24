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
    FALLBACK_ASSET_MBR,
    FALLBACK_BASE_ACCOUNT_MBR,
} from '@perawallet/wallet-core-blockchain/constants'

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
import { getConformanceClient } from '../../harness/client'
import {
    createConformanceKeyStore,
    type ConformanceKeyStore,
} from '../../harness/keystore'

const minBalanceOf = async (address: string): Promise<bigint> =>
    (await getConformanceClient().client.algod.accountInformation(address).do())
        .minBalance

/**
 * Reads `accountInformation().minBalance` directly off algod — the ground
 * truth — and checks it against the app's own predicted MBR constants
 * (`FALLBACK_ASSET_MBR`/`FALLBACK_BASE_ACCOUNT_MBR`, `constants.ts:14,17`),
 * a source independent of the algod reading itself: `useMinimumFeeConfig`'s
 * remote-config path isn't reachable headlessly, so this pins the fallback
 * the app falls back to whenever remote config is unavailable.
 */
describe('MBR prediction conformance', () => {
    let keyStore: ConformanceKeyStore
    let assetCreator: ConformanceAccount
    let assetOne: bigint
    let assetTwo: bigint

    beforeAll(async () => {
        keyStore = await createConformanceKeyStore()
        assetCreator = await createAlgo25Account(keyStore)
        await fundAccount(assetCreator.address, 2_000_000n)
        assetOne = await createTestAsset(keyStore, assetCreator, {
            total: 1000n,
            unitName: 'MBR1',
        })
        assetTwo = await createTestAsset(keyStore, assetCreator, {
            total: 1000n,
            unitName: 'MBR2',
        })
    })

    it('a freshly funded account carries exactly the base account MBR', async () => {
        const account = await createAlgo25Account(keyStore)
        await fundAccount(account.address, 1_000_000n)

        const minBalance = await minBalanceOf(account.address)
        expect(minBalance).toBe(FALLBACK_BASE_ACCOUNT_MBR)
    })

    it('two asset opt-ins each raise minBalance by exactly assetMbr — per-asset and linear', async () => {
        const holder = await createAlgo25Account(keyStore)
        await fundAccount(holder.address, 1_000_000n)

        const beforeOptIns = await minBalanceOf(holder.address)
        // Guards the starting point this test's deltas are computed from, so
        // a partial `-t` run (or a future case that funds `holder` further
        // before this point) fails loudly instead of the deltas below
        // silently comparing against a moved baseline.
        if (beforeOptIns !== FALLBACK_BASE_ACCOUNT_MBR) {
            throw new Error(
                `holder's minBalance before any opt-in is ${beforeOptIns}, expected the base account MBR ${FALLBACK_BASE_ACCOUNT_MBR}`,
            )
        }

        const optInTxn = async (assetId: bigint): Promise<void> => {
            const txn = await buildTxn(composer => {
                composer.addAssetOptIn({ sender: holder.address, assetId })
            })
            await submitAndConfirm(
                await signWithKeystore(keyStore, holder, txn),
            )
        }

        await optInTxn(assetOne)
        const afterFirst = await minBalanceOf(holder.address)
        expect(afterFirst - beforeOptIns).toBe(FALLBACK_ASSET_MBR)

        await optInTxn(assetTwo)
        const afterSecond = await minBalanceOf(holder.address)
        expect(afterSecond - afterFirst).toBe(FALLBACK_ASSET_MBR)

        // Linearity: two opt-ins cost exactly twice one opt-in, not a
        // shared/discounted rate.
        expect(afterSecond - beforeOptIns).toBe(FALLBACK_ASSET_MBR * 2n)
    })
})
