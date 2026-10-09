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

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { setupServer, type SetupServer } from 'msw/node'
import type { RequestHandler } from 'msw'
import type { Decimal } from 'decimal.js'
import type {
    AddressCodec,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
// Type-only, so a chain package can run this suite without loading kms.
import type { AccountsChainAdapter } from '../chain-adapter'

export type AccountStateOps = Pick<
    AccountsChainAdapter,
    | 'chainId'
    | 'fetchAccountState'
    | 'accountExists'
    | 'checkActivity'
    | 'fetchChangeSignal'
>

type ChainState = {
    address: string
    /** Installed before the call, so the adapter reads this state. */
    handlers: readonly RequestHandler[]
}

export interface AccountStateContractFixtures {
    scope: ChainScope
    /** The chain's own codec: every address the adapter returns must pass it. */
    codec: AddressCodec
    /** An account holding the native asset. */
    funded: ChainState & {
        nativeAssetId: string
        /** Display units. */
        nativeBalance: Decimal
        /** Another asset it holds; omit on a chain that reads native holdings only. */
        heldAssetId?: string
    }
    /** An address with no on-chain footprint at all. */
    empty: ChainState
    /** The activity probe reporting `active` as active and `inactive` as not. */
    activity: {
        active: string
        inactive: string
        handlers: readonly RequestHandler[]
    }
    /** Handlers under which every activity probe fails. */
    activityFailure: readonly RequestHandler[]
    /** Required when the adapter implements `fetchChangeSignal`. */
    changeSignal?: {
        addresses: string[]
        cursor: number
        /** Handlers under which an address changed after `cursor`; the signal returns `nextCursor`. */
        changed: { handlers: readonly RequestHandler[]; nextCursor: number }
        /** Handlers under which nothing changed after `cursor`. */
        unchanged: { handlers: readonly RequestHandler[]; nextCursor: number }
    }
}

/** The account-state cases, registered inside the caller's describe against its server. */
export const accountStateCases = (
    makeOps: () => AccountStateOps,
    fixtures: AccountStateContractFixtures,
    server: SetupServer,
): void => {
    const { scope, codec } = fixtures

    it('reads account state with the native asset among the holdings', async () => {
        server.use(...fixtures.funded.handlers)

        const state = await makeOps().fetchAccountState(
            fixtures.funded.address,
            scope,
            { priorResourceCount: 0 },
        )

        expect(state.nativeBalance.toString()).toBe(
            fixtures.funded.nativeBalance.toString(),
        )
        const heldIds = state.holdings.map(h => h.assetId)
        expect(heldIds).toContain(fixtures.funded.nativeAssetId)
        if (fixtures.funded.heldAssetId !== undefined) {
            expect(heldIds).toContain(fixtures.funded.heldAssetId)
        }
        if (state.authorityAddress !== null) {
            expect(codec.isValid(state.authorityAddress)).toBe(true)
        }
    })

    it('tells a funded account from an address with no footprint', async () => {
        server.use(...fixtures.funded.handlers, ...fixtures.empty.handlers)
        const ops = makeOps()

        await expect(
            ops.accountExists(fixtures.funded.address, scope),
        ).resolves.toBe(true)
        await expect(
            ops.accountExists(fixtures.empty.address, scope),
        ).resolves.toBe(false)
    })

    it('answers activity per address', async () => {
        server.use(...fixtures.activity.handlers)
        const { active, inactive } = fixtures.activity

        const activity = await makeOps().checkActivity(
            [active, inactive],
            scope,
        )

        expect(activity.get(active)).toBe(true)
        expect(activity.get(inactive)).toBe(false)
    })

    it('reads a failed activity probe as inactive instead of rejecting', async () => {
        server.use(...fixtures.activityFailure)
        const { active, inactive } = fixtures.activity

        const activity = await makeOps().checkActivity(
            [active, inactive],
            scope,
        )

        expect(activity.get(active) ?? false).toBe(false)
        expect(activity.get(inactive) ?? false).toBe(false)
    })

    it('reports a change after the cursor with the next cursor, or has no signal', async () => {
        const ops = makeOps()
        if (!ops.fetchChangeSignal) return

        expect(fixtures.changeSignal).toBeDefined()
        const { addresses, cursor, changed } = fixtures.changeSignal!
        server.use(...changed.handlers)

        await expect(
            ops.fetchChangeSignal(addresses, scope, cursor),
        ).resolves.toEqual({ changed: true, cursor: changed.nextCursor })
    })

    it('reports no change when nothing changed after the cursor, or has no signal', async () => {
        const ops = makeOps()
        if (!ops.fetchChangeSignal) return

        expect(fixtures.changeSignal).toBeDefined()
        const { addresses, cursor, unchanged } = fixtures.changeSignal!
        server.use(...unchanged.handlers)

        await expect(
            ops.fetchChangeSignal(addresses, scope, cursor),
        ).resolves.toEqual({ changed: false, cursor: unchanged.nextCursor })
    })

    it('reports a change for a scope that has never synced, or has no signal', async () => {
        const ops = makeOps()
        if (!ops.fetchChangeSignal) return

        expect(fixtures.changeSignal).toBeDefined()
        const { addresses, unchanged } = fixtures.changeSignal!
        server.use(...unchanged.handlers)

        const signal = await ops.fetchChangeSignal(addresses, scope, null)

        expect(signal.changed).toBe(true)
    })
}

/** A chain package runs this against its account-state operations before its full adapter exists. */
export const accountStateContractTests = (
    makeOps: () => AccountStateOps,
    fixtures: AccountStateContractFixtures,
    label?: string,
): void => {
    const server = setupServer()

    describe(`AccountsChainAdapter account-state contract: ${makeOps().chainId}${label ? ` (${label})` : ''}`, () => {
        beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
        afterEach(() => server.resetHandlers())
        afterAll(() => server.close())

        accountStateCases(makeOps, fixtures, server)
    })
}
