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

import { describe, expect, it, vi } from 'vitest'
import {
    ChainAdapterNotRegisteredError,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import {
    aggregateTransactionWarnings,
    classifyRequestStructure,
    createTransactionListItems,
    decodeArbitraryDataForDisplay,
    getRekeyedUnsignableReason,
    resolveAllSignerAddresses,
    reviewerAdapterFor,
    reviewerChainAdapters,
    type ReviewerChainAdapter,
} from '../chain-adapter'
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
