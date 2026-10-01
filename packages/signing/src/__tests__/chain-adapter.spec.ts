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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    ChainAdapterNotRegisteredError,
    DuplicateChainAdapterError,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import {
    aggregateTransactionWarnings,
    classifyRequestStructure,
    computeBalanceImpact,
    createTransactionListItems,
    decodeArbitraryDataForDisplay,
    encodeProgramAccount,
    getRekeyedUnsignableReason,
    legacyPlannerAdapter,
    plannerAdapterFor,
    plannerChainAdapters,
    resolveAllSignerAddresses,
    resolveMinFeeForSender,
    reviewerAdapterFor,
    reviewerChainAdapters,
    type ReviewerChainAdapter,
} from '../chain-adapter'
import {
    fakePlannerAdapter,
    registerFakePlannerAdapter,
} from './fakePlannerAdapter'
import { registerFakeReviewerAdapter } from './fakeReviewerAdapter'

type WrapperName =
    | 'createTransactionListItems'
    | 'classifyRequestStructure'
    | 'aggregateTransactionWarnings'
    | 'resolveAllSignerAddresses'
    | 'getRekeyedUnsignableReason'
    | 'decodeArbitraryDataForDisplay'

const wrappers: Record<WrapperName, (...args: never[]) => unknown> = {
    createTransactionListItems,
    classifyRequestStructure,
    aggregateTransactionWarnings,
    resolveAllSignerAddresses,
    getRekeyedUnsignableReason,
    decodeArbitraryDataForDisplay,
}

const argsByWrapper: Record<WrapperName, unknown[]> = {
    createTransactionListItems: [[], new Set([0])],
    classifyRequestStructure: [[]],
    aggregateTransactionWarnings: [
        [],
        new Set(['A']),
        new Set(['B']),
        new Map(),
    ],
    resolveAllSignerAddresses: [{ id: 'r1' }],
    getRekeyedUnsignableReason: [{ id: 'r1' }, []],
    decodeArbitraryDataForDisplay: ['aGk='],
}

const names = Object.keys(wrappers) as WrapperName[]
const call = (name: WrapperName) =>
    (wrappers[name] as (...a: unknown[]) => unknown)(
        LEGACY_CHAIN_ID,
        ...argsByWrapper[name],
    )

describe('reviewer chain adapter registry', () => {
    it('resolves the registered adapter for a network', () => {
        const adapter = registerFakeReviewerAdapter()

        expect(reviewerAdapterFor('testnet')).toBe(adapter)
    })

    it.each(names)('%s forwards its args to the adapter', name => {
        const impl = vi.fn(() => 'sentinel')
        registerFakeReviewerAdapter({
            [name]: impl,
        } as Partial<ReviewerChainAdapter>)

        const result = call(name)

        expect(impl).toHaveBeenCalledWith(...argsByWrapper[name])
        expect(result).toBe('sentinel')
    })

    it.each(names)('%s throws when no adapter is registered', name => {
        reviewerChainAdapters.reset()

        expect(() => call(name)).toThrow(ChainAdapterNotRegisteredError)
    })

    it('reviewerAdapterFor throws when no adapter is registered', () => {
        reviewerChainAdapters.reset()

        expect(() => reviewerAdapterFor('mainnet')).toThrow(
            ChainAdapterNotRegisteredError,
        )
    })
})

describe('planner chain adapters', () => {
    beforeEach(() => {
        plannerChainAdapters.reset()
    })

    it('resolves the registered adapter for a legacy network', () => {
        const adapter = registerFakePlannerAdapter()

        expect(plannerAdapterFor('mainnet')).toBe(adapter)
        expect(plannerAdapterFor('testnet')).toBe(adapter)
        expect(legacyPlannerAdapter()).toBe(adapter)
    })

    it('throws ChainAdapterNotRegisteredError when no planner is registered', () => {
        expect(() => plannerAdapterFor('mainnet')).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() => legacyPlannerAdapter()).toThrow(
            'No planner adapter is registered for chain "algorand"',
        )
    })

    it('refuses a second adapter for the same chain', () => {
        registerFakePlannerAdapter()

        expect(() =>
            plannerChainAdapters.register(fakePlannerAdapter()),
        ).toThrow(DuplicateChainAdapterError)
    })

    it('delegates the network-less exports to the registered adapter', () => {
        const impact = {
            deltas: [],
            totalFeeMicroAlgos: 7n,
            hasCloseRemainder: false,
            closedAssetIds: [],
            createdAssets: [],
        }
        const adapter = registerFakePlannerAdapter({
            minFeeForSender: vi.fn(() => 4000n),
            computeBalanceImpact: vi.fn(() => impact),
            encodeProgramAccount: vi.fn(() => new Uint8Array([5])),
        })
        const feeParams = {
            senderAddress: 'A',
            accounts: [],
            suggestedMinFee: 1000n,
            configMinTxnFee: 1000n,
            pqMultiplier: 3n,
        }
        const signable = new Set(['A'])
        const program = new Uint8Array([1])
        const sig = new Uint8Array([2])

        expect(resolveMinFeeForSender(feeParams)).toBe(4000n)
        expect(computeBalanceImpact([], signable)).toBe(impact)
        expect(encodeProgramAccount(program, sig, 'A')).toEqual(
            new Uint8Array([5]),
        )

        expect(adapter.minFeeForSender).toHaveBeenCalledWith(feeParams)
        expect(adapter.computeBalanceImpact).toHaveBeenCalledWith([], signable)
        expect(adapter.encodeProgramAccount).toHaveBeenCalledWith(
            program,
            sig,
            'A',
        )
    })
})
