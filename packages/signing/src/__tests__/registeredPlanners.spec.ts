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

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'

import type * as ChainAdapterModule from '../chain-adapter'
import type * as FakePlannerModule from './fakePlannerAdapter'

let plannerChainAdapters: typeof ChainAdapterModule.plannerChainAdapters
let registeredPlanners: typeof ChainAdapterModule.registeredPlanners
let fakePlannerAdapter: typeof FakePlannerModule.fakePlannerAdapter
let registerFakePlannerAdapter: typeof FakePlannerModule.registerFakePlannerAdapter

// The setup file already loaded the registry with the real build flags, so a
// fresh copy is loaded under a debug build.
beforeAll(async () => {
    vi.resetModules()
    vi.doMock('@perawallet/wallet-core-config', async importOriginal => ({
        ...(await importOriginal<object>()),
        isDebug: true,
    }))
    ;({ plannerChainAdapters, registeredPlanners } =
        await import('../chain-adapter'))
    ;({ fakePlannerAdapter, registerFakePlannerAdapter } =
        await import('./fakePlannerAdapter'))
})

const ethereumPlanner = () =>
    fakePlannerAdapter({ chainId: 'ethereum' as ChainId })

describe('registeredPlanners in a debug build', () => {
    beforeEach(() => {
        plannerChainAdapters.reset()
    })

    it('keeps the list fixed from first use, so hooks never change mid-session', () => {
        const algorand = registerFakePlannerAdapter()

        const first = registeredPlanners()

        expect(first).toEqual([algorand])
        expect(registeredPlanners()).toBe(first)
    })

    it('throws when a planner registers after the list was first used', () => {
        registerFakePlannerAdapter()
        registeredPlanners()

        expect(() => plannerChainAdapters.register(ethereumPlanner())).toThrow(
            'registered after planner hooks first ran',
        )
        expect(plannerChainAdapters.has('ethereum')).toBe(false)
    })

    it('still accepts the same instance again after first use', () => {
        const algorand = registerFakePlannerAdapter()
        registeredPlanners()

        expect(() => plannerChainAdapters.register(algorand)).not.toThrow()
    })

    it('starts a new list after reset', () => {
        registerFakePlannerAdapter()
        registeredPlanners()

        plannerChainAdapters.reset()
        const ethereum = ethereumPlanner()
        plannerChainAdapters.register(ethereum)

        expect(registeredPlanners()).toEqual([ethereum])
    })
})
