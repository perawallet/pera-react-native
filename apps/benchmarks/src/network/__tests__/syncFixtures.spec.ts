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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { benchWatchAccounts } from '../../data/generators'
import type { BenchScale } from '../../runner/types'
import { startFixtureNetwork, type FixtureNetwork } from '../fixtureNetwork'
import { syncFixtureHandlers, type FixtureAmounts } from '../syncFixtures'

// The real modules load package code that needs native modules.
vi.mock('../../data/addresses', async () => ({
    encodeAlgorandAddress: (await import('algosdk')).encodeAddress,
}))
vi.mock('../handlers', async () => {
    const { http } = await import('msw')
    return {
        mockShouldRefresh: () => http.get('*/should-refresh', () => undefined),
        evmRpcHandlers: () => [],
        peraEvmHandlers: () => [],
    }
})

const ALGORAND = 'algorand'
const ALGOD = 'https://algod.test/v2/accounts'

// Account 0 holds all 1001 assets, one past algod's inline cap.
const SCALE: BenchScale = {
    name: 'S',
    accounts: 2,
    heavyAccountAssets: 1001,
    assetsPerAccount: 1,
    heavyAccountTransactions: 0,
    chains: 1,
}

type Holding = { amount: number }

describe('syncFixtureHandlers account reads', () => {
    const realFetch = globalThis.fetch
    let network: FixtureNetwork
    let amounts: FixtureAmounts
    let heavy: string
    let light: string

    beforeEach(() => {
        const accounts = benchWatchAccounts(SCALE.accounts, [ALGORAND])
        heavy = accounts[0].chains.algorand?.address ?? ''
        light = accounts[1].chains.algorand?.address ?? ''
        amounts = { variant: 0 }
        network = startFixtureNetwork()
        network.use(
            ...syncFixtureHandlers(
                {
                    accounts,
                    heavyAddress: heavy,
                    heldAssetIds: [],
                    chainIds: [ALGORAND],
                },
                SCALE,
                { refresh: true, amounts },
            ),
        )
    })

    afterEach(() => {
        globalThis.fetch = realFetch
    })

    it('refuses a full read past the cap and pages the holdings from the indexer instead', async () => {
        const full = await fetch(`${ALGOD}/${heavy}`)
        const scalars = await (
            await fetch(`${ALGOD}/${heavy}?exclude=all`)
        ).json()
        const first = await (
            await fetch(`${ALGOD}/${heavy}/assets?limit=1000`)
        ).json()
        const last = await (
            await fetch(`${ALGOD}/${heavy}/assets?limit=1000&next=1000`)
        ).json()

        expect(full.status).toBe(400)
        expect(scalars['total-assets-opted-in']).toBe(1001)
        expect(scalars.assets).toBeUndefined()
        expect(first.assets).toHaveLength(1000)
        expect(first['next-token']).toBe('1000')
        expect(last.assets).toHaveLength(1)
        expect(last['next-token']).toBeUndefined()
    })

    it('answers each read with the amounts current at that moment', async () => {
        const before = await (await fetch(`${ALGOD}/${light}`)).json()
        amounts.variant += 1
        const after = await (await fetch(`${ALGOD}/${light}`)).json()

        expect(before.assets).toHaveLength(1)
        expect(after.assets.map((h: Holding) => h.amount)).toEqual(
            before.assets.map((h: Holding) => h.amount + 1),
        )
    })

    it('leaves an address outside the wallet unanswered', async () => {
        await expect(fetch(`${ALGOD}/STRANGER`)).rejects.toThrow(TypeError)

        expect(network.unhandledRequests()).toEqual([`GET ${ALGOD}/STRANGER`])
    })
})
