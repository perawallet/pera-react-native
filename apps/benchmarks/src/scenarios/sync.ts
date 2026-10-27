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

import { QueryClient } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import {
    getAccountHoldings,
    getAllHeldAssetIdsForNetwork,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import {
    AssetPriceMissesSchema,
    AssetPricesSchema,
    fetchAndPersistPrices,
    PeraAssetType,
    seedNativeAssets,
    upsertNodeAssets,
} from '@perawallet/wallet-core-assets'
import {
    createSyncStorePorts,
    SyncService,
    useSyncCursorStore,
} from '@perawallet/wallet-core-background'
import { clearDatabase, getDatabase } from '@perawallet/wallet-core-database'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { benchAssets, benchWatchAccounts } from '../data/generators'
import { chainsFor } from '../data/chains'
import { benchScope } from '../data/scope'
import type { SeededWallet } from '../data/seedWallet'
import { mockShouldRefresh } from '../network/handlers'
import {
    syncFixtureHandlers,
    type FixtureAmounts,
} from '../network/syncFixtures'
import type { BenchScale, Scenario, ScenarioContext } from '../runner/types'
import { seeded } from './seeded'

const SYNC_SCALES = ['S', 'M', 'L'] as const
const FIXTURE_ROUND = 120

const newService = (): SyncService =>
    new SyncService({
        queryClient: new QueryClient(),
        stores: createSyncStorePorts(),
        chains: getProvider().chains,
    })

// The tick is private and returns when it has finished, so awaiting it times
// the work itself; polling a flag would round every sample up to the poll.
// `start()` is not called, so `running` stays false and the service schedules
// no follow-up tick: there is nothing to stop.
type Tickable = { tick(): Promise<void> }

const tickOf = (service: SyncService): (() => Promise<void>) => {
    const candidate = service as unknown as Partial<Tickable>
    if (typeof candidate.tick !== 'function') {
        throw new Error(
            'SyncService has no tick() any more: the sync scenarios need updating',
        )
    }
    return candidate.tick.bind(service)
}

/** One tick, awaited. */
export const runTick = (service: SyncService): Promise<void> =>
    tickOf(service)()

const assertAnswered = (ctx: ScenarioContext): void => {
    const unanswered = ctx.network.unhandledRequests()
    if (unanswered.length > 0) {
        throw new Error(
            `${unanswered.length} requests had no fixture, first: ${unanswered[0]}`,
        )
    }
}

/**
 * A tick that has nothing to do (a chain switched off, no adapter, sync paused
 * or the device offline) returns at once and would time as a very fast pass.
 * The fixture network counts every request, so a tick that made fewer than
 * `minRequests` did not do the work being measured.
 */
const proveWork = async (
    ctx: ScenarioContext,
    label: string,
    minRequests: number,
    work: () => Promise<void>,
): Promise<void> => {
    const before = ctx.network.requestCount()
    await work()
    const made = ctx.network.requestCount() - before
    if (made < minRequests) {
        throw new Error(
            `${label} made ${made} requests, expected at least ${minRequests}: sync did not run`,
        )
    }
    assertAnswered(ctx)
}

export const provenTick = (
    ctx: ScenarioContext,
    service: SyncService,
    minRequests: number,
): Promise<void> =>
    proveWork(ctx, 'The tick', minRequests, () => runTick(service))

export type TickState = {
    service: SyncService
    ctx: ScenarioContext
    scale: BenchScale
    scope: ChainScope
    /** The fewest requests a real tick of this scenario makes. */
    minRequests: number
    /** What the fixture's account reads answer; bumped to make a tick see a change. */
    amounts: FixtureAmounts
    heavyAddress: string
    /** The heavy account's stored amounts as of the last tick, to prove a change landed. */
    storedAmounts: string
}

/** A wallet of accounts only: the database empty, as just after an import. */
const accountsOnly = (scale: BenchScale): SeededWallet => {
    const chainIds = chainsFor(scale)
    const accounts = benchWatchAccounts(scale.accounts, chainIds)
    useAccountsStore.getState().setAccounts(accounts)
    return {
        accounts,
        heavyAddress: accounts[0].chains.algorand?.address ?? '',
        heldAssetIds: [],
        chainIds,
    }
}

/**
 * The tick logs and backs off from a failing account or a response the app
 * cannot parse, so it can return having stored nothing. The heavy account
 * holds every generated asset, so a tick that parsed the fixtures leaves at
 * least that many held assets behind.
 */
const assertSynced = async (
    scale: BenchScale,
    scope: ChainScope,
): Promise<void> => {
    const held = await getAllHeldAssetIdsForNetwork({ scope })
    if (held.length < scale.heavyAccountAssets) {
        throw new Error(
            `The tick stored ${held.length} held assets, expected at least ${scale.heavyAccountAssets}: the app did not accept the fixtures`,
        )
    }
}

const storedAmountsOf = async (state: TickState): Promise<string> => {
    const rows = await getAccountHoldings({
        accountAddress: state.heavyAddress,
        scope: state.scope,
    })
    return rows
        .reduce((sum, row) => sum.plus(row.amount), new Decimal(0))
        .toString()
}

/**
 * Makes the fixture answer the next account read with different amounts, so
 * the tick that follows has holdings to write. Without it a repeat tick reads
 * the same holdings back and the sync's own diff skips every write.
 */
export const changeHoldings = async (state: TickState): Promise<void> => {
    state.amounts.variant += 1
}

/** The tick has to have written the changed amounts, or it timed a no-op diff. */
export const assertHoldingsChanged = async (
    state: TickState,
): Promise<void> => {
    const stored = await storedAmountsOf(state)
    if (stored === state.storedAmounts) {
        throw new Error(
            'The tick left the stored holdings as they were: it timed a no-op diff, not a change',
        )
    }
    state.storedAmounts = stored
}

const firstTick: Scenario<TickState> = {
    id: 'sync.first-tick',
    group: 'sync',
    title: 'The first tick over an empty database',
    scales: SYNC_SCALES,
    iterations: 3,
    warmup: 0,
    setup: async (ctx, scale) => {
        const wallet = accountsOnly(scale)
        const amounts = { variant: 0 }
        ctx.network.use(
            ...syncFixtureHandlers(wallet, scale, { refresh: true, amounts }),
        )
        return {
            service: newService(),
            ctx,
            scale,
            scope: benchScope(),
            // The first tick forces a read of every account.
            minRequests: scale.accounts,
            amounts,
            heavyAddress: wallet.heavyAddress,
            storedAmounts: '',
        }
    },
    // Emptying the tables stands in for a fresh install.
    beforeEach: async state => {
        await clearDatabase(getDatabase(), { keep: [] })
        await seedNativeAssets(getDatabase())
        useSyncCursorStore.getState().resetState()
        state.service = newService()
    },
    run: state => provenTick(state.ctx, state.service, state.minRequests),
    afterEach: state => assertSynced(state.scale, state.scope),
}

/**
 * Stores every collectible's url as already looked up. An established wallet
 * did that long ago; left unset, each tick that syncs metadata spends up to
 * 100 indexer lookups backfilling them, which a changed tick would then time.
 */
const markCollectibleUrlsKnown = (
    scale: BenchScale,
    scope: ChainScope,
): Promise<void> =>
    upsertNodeAssets({
        items: benchAssets(scale.heavyAccountAssets)
            .filter(
                asset => asset.peraMetadata?.type === PeraAssetType.collectible,
            )
            .map(asset => ({ ...asset, url: '' })),
        scope,
    })

/** The first tick has run, so the next goes through the change signal. */
export const afterFirstTick =
    (refresh: boolean, minRequests: (scale: BenchScale) => number) =>
    async (ctx: ScenarioContext, scale: BenchScale): Promise<TickState> => {
        const wallet = accountsOnly(scale)
        const scope = benchScope()
        const amounts = { variant: 0 }
        ctx.network.use(
            ...syncFixtureHandlers(wallet, scale, { refresh: true, amounts }),
        )
        const service = newService()
        await provenTick(ctx, service, scale.accounts)
        await assertSynced(scale, scope)
        await markCollectibleUrlsKnown(scale, scope)
        ctx.network.use(
            mockShouldRefresh({ response: { refresh, round: FIXTURE_ROUND } }),
        )
        const state: TickState = {
            service,
            ctx,
            scale,
            scope,
            minRequests: minRequests(scale),
            amounts,
            heavyAddress: wallet.heavyAddress,
            storedAmounts: '',
        }
        state.storedAmounts = await storedAmountsOf(state)
        return state
    }

const tickRun = (state: TickState): Promise<void> =>
    provenTick(state.ctx, state.service, state.minRequests)

const steadyTick: Scenario<TickState> = {
    id: 'sync.steady-tick',
    group: 'sync',
    title: 'A tick when the change signal reports nothing new',
    scales: SYNC_SCALES,
    // Nothing changed, so only the change signal is asked.
    setup: afterFirstTick(false, () => 1),
    run: tickRun,
}

export const changedTick: Scenario<TickState> = {
    id: 'sync.changed-tick',
    group: 'sync',
    title: 'A tick when the change signal reports a change',
    scales: SYNC_SCALES,
    // A change reads every account again, and every holding in it differs.
    setup: afterFirstTick(true, scale => scale.accounts),
    beforeEach: changeHoldings,
    run: tickRun,
    afterEach: assertHoldingsChanged,
}

type PriceState = {
    ctx: ScenarioContext
    heldAssetIds: string[]
    scope: ChainScope
}

const pricePass: Scenario<PriceState> = {
    id: 'sync.price-pass',
    group: 'sync',
    title: 'Fetch prices for every held asset',
    scales: SYNC_SCALES,
    setup: async (ctx, scale) => {
        const { wallet, scope } = await seeded({ withPrices: false })(
            ctx,
            scale,
        )
        ctx.network.use(
            ...syncFixtureHandlers(wallet, scale, { refresh: true }),
        )
        return { ctx, heldAssetIds: wallet.heldAssetIds, scope }
    },
    // Within the cache window a second pass would skip every id, so each run
    // starts with the price tables empty.
    beforeEach: async () => {
        const db = getDatabase()
        await db.delete(AssetPricesSchema).run()
        await db.delete(AssetPriceMissesSchema).run()
    },
    run: ({ ctx, heldAssetIds, scope }) =>
        proveWork(ctx, 'The price pass', 1, () =>
            fetchAndPersistPrices(heldAssetIds, scope),
        ),
    afterEach: async () => {
        const priced = await getDatabase()
            .select({ assetId: AssetPricesSchema.assetId })
            .from(AssetPricesSchema)
            .all()
        if (priced.length === 0) {
            throw new Error(
                'The price pass stored no prices: the app did not accept the fixtures',
            )
        }
    },
}

export const syncScenarios: Scenario[] = [
    firstTick as Scenario,
    steadyTick as Scenario,
    changedTick as Scenario,
    pricePass as Scenario,
]
