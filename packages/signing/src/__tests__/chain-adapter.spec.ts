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
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    aggregateTransactionWarnings,
    classifyHandoffPoll,
    classifyRequestStructure,
    completeMultisigHandoff,
    computeBalanceImpact,
    createTransactionListItems,
    decodeArbitraryDataForDisplay,
    encodeProgramAccount,
    getDelegatedUnsignableReason,
    isSignRequestMultisigUnsignable,
    localKeySignerAdapterFor,
    localKeySignerChainAdapters,
    needsSimulation,
    plannerAdapterForScope,
    plannerChainAdapters,
    registeredPlanners,
    resolveAllSignerAddresses,
    resolveMinFeeForSender,
    reviewerChainAdapters,
    type HandoffAssemblyContext,
    type HandoffPollDetail,
    type ReviewerChainAdapter,
} from '../chain-adapter'
import {
    fakeLocalKeySignerAdapter,
    registerFakeLocalKeySignerAdapter,
} from './fakeLocalKeySignerAdapter'
import {
    fakePlannerAdapter,
    registerFakePlannerAdapter,
} from './fakePlannerAdapter'
import { registerFakeReviewerAdapter } from './fakeReviewerAdapter'
import { makeUnsignedTransaction } from './transactions'

type WrapperName =
    | 'createTransactionListItems'
    | 'classifyRequestStructure'
    | 'aggregateTransactionWarnings'
    | 'resolveAllSignerAddresses'
    | 'getDelegatedUnsignableReason'
    | 'decodeArbitraryDataForDisplay'

const wrappers: Record<WrapperName, (...args: never[]) => unknown> = {
    createTransactionListItems,
    classifyRequestStructure,
    aggregateTransactionWarnings,
    resolveAllSignerAddresses,
    getDelegatedUnsignableReason,
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
    getDelegatedUnsignableReason: [{ id: 'r1' }, []],
    decodeArbitraryDataForDisplay: ['aGk='],
}

const names = Object.keys(wrappers) as WrapperName[]
const call = (name: WrapperName) =>
    (wrappers[name] as (...a: unknown[]) => unknown)(
        LEGACY_CHAIN_ID,
        ...argsByWrapper[name],
    )

describe('reviewer chain adapter registry', () => {
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
})

describe('planner chain adapters', () => {
    beforeEach(() => {
        plannerChainAdapters.reset()
    })

    it("resolves the registered adapter for a scope's chain", () => {
        const adapter = registerFakePlannerAdapter()

        expect(
            plannerAdapterForScope({
                chainId: 'algorand',
                networkId: 'mainnet',
            }),
        ).toBe(adapter)
        expect(
            plannerAdapterForScope({
                chainId: 'algorand',
                networkId: 'testnet',
            }),
        ).toBe(adapter)
    })

    it('throws ChainAdapterNotRegisteredError when no planner is registered', () => {
        expect(() =>
            plannerAdapterForScope({
                chainId: 'algorand',
                networkId: 'mainnet',
            }),
        ).toThrow('No planner adapter is registered for chain "algorand"')
    })

    it('refuses a second adapter for the same chain', () => {
        registerFakePlannerAdapter()

        expect(() =>
            plannerChainAdapters.register(fakePlannerAdapter()),
        ).toThrow(DuplicateChainAdapterError)
    })

    it("delegates the chain-keyed exports to that chain's adapter", () => {
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

        expect(resolveMinFeeForSender('algorand', feeParams)).toBe(4000n)
        expect(computeBalanceImpact('algorand', [], signable)).toBe(impact)
        expect(encodeProgramAccount('algorand', program, sig, 'A')).toEqual(
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

describe('planner helpers on a chain that registers no planner', () => {
    const NO_PLANNER_CHAIN = 'fixturehex' as ChainId

    beforeEach(() => {
        registerFakePlannerAdapter()
    })

    it('keeps the suggested minimum fee, so no fee override applies', () => {
        expect(
            resolveMinFeeForSender(NO_PLANNER_CHAIN, {
                senderAddress: 'A',
                accounts: [],
                suggestedMinFee: 1000n,
                configMinTxnFee: 2000n,
                pqMultiplier: 3n,
            }),
        ).toBe(1000n)
    })

    it('reports no balance impact', () => {
        expect(
            computeBalanceImpact(NO_PLANNER_CHAIN, [], new Set(['A'])),
        ).toEqual({
            deltas: [],
            totalFeeMicroAlgos: 0n,
            hasCloseRemainder: false,
            closedAssetIds: [],
            createdAssets: [],
        })
    })

    it('needs no simulation', () => {
        expect(needsSimulation(NO_PLANNER_CHAIN, [])).toBe(false)
    })

    it('treats a chain-neutral request as not multisig-unsignable', () => {
        const request = {
            id: 'r1',
            type: 'transactions',
            txs: [
                makeUnsignedTransaction('0xA', {
                    chainId: NO_PLANNER_CHAIN,
                    networkId: 'devnet',
                }),
            ],
        } as never

        expect(isSignRequestMultisigUnsignable(request, [])).toBe(false)
    })

    it('leaves the registered planner untouched', () => {
        const [planner] = registeredPlanners()
        isSignRequestMultisigUnsignable(
            { chainId: NO_PLANNER_CHAIN } as never,
            [],
        )
        computeBalanceImpact(NO_PLANNER_CHAIN, [], new Set())

        expect(planner.isSignRequestMultisigUnsignable).not.toHaveBeenCalled()
        expect(planner.computeBalanceImpact).not.toHaveBeenCalled()
    })
})

describe('registered planners', () => {
    it('lists each planner once, in registration order, until reset', () => {
        const algorand = registerFakePlannerAdapter()
        const fixture = fakePlannerAdapter({
            chainId: 'fixturehex' as ChainId,
        })
        plannerChainAdapters.register(fixture)
        plannerChainAdapters.register(fixture)

        expect(registeredPlanners()).toEqual([algorand, fixture])

        plannerChainAdapters.reset()
        expect(registeredPlanners()).toEqual([])
    })
})

describe('multisig members of the planner', () => {
    it('routes the thin classifyHandoffPoll by the handoff scope', async () => {
        const outcome = { kind: 'keep-polling' } as const
        const adapter = registerFakePlannerAdapter({
            classifyHandoffPoll: vi.fn().mockResolvedValue(outcome),
        })
        const detail = {
            status: 'pending',
            fail_reason_display: null,
            transaction_lists: [],
        } satisfies HandoffPollDetail
        const context: HandoffAssemblyContext = {
            scope: { chainId: 'algorand', networkId: 'testnet' },
            multisigAddress: 'MSIG',
            msigMetadata: { version: 1, threshold: 2, addresses: ['A', 'B'] },
            expectedRawTransactionsBase64: [],
        }

        await expect(classifyHandoffPoll(detail, context)).resolves.toBe(
            outcome,
        )

        expect(adapter.classifyHandoffPoll).toHaveBeenCalledWith(
            detail,
            context,
        )
    })

    it("delegates completion to the named chain and the unsignable check to the request's chain", async () => {
        const adapter = registerFakePlannerAdapter({
            completeMultisigHandoff: vi.fn().mockResolvedValue(undefined),
            isSignRequestMultisigUnsignable: vi.fn(() => true),
        })
        const args = {
            outcome: { kind: 'soft-reject', reason: 'declined' },
            deps: {},
        } as unknown as Parameters<typeof completeMultisigHandoff>[1]

        await completeMultisigHandoff('algorand', args)

        expect(adapter.completeMultisigHandoff).toHaveBeenCalledWith(args)
        const request = { chainId: 'algorand' } as never
        expect(isSignRequestMultisigUnsignable(request, [])).toBe(true)
        expect(adapter.isSignRequestMultisigUnsignable).toHaveBeenCalledWith(
            request,
            [],
        )
    })
})

describe('local-key signer chain adapters', () => {
    beforeEach(() => {
        localKeySignerChainAdapters.reset()
    })

    it("resolves the adapter registered for the scope's chain", () => {
        const adapter = registerFakeLocalKeySignerAdapter()

        expect(
            localKeySignerAdapterFor({
                chainId: 'algorand',
                networkId: 'mainnet',
            }),
        ).toBe(adapter)
        expect(
            localKeySignerAdapterFor({
                chainId: 'algorand',
                networkId: 'testnet',
            }),
        ).toBe(adapter)
    })

    it('throws ChainAdapterNotRegisteredError when no local-key signer is registered', () => {
        const scope = { chainId: 'algorand', networkId: 'mainnet' } as const
        expect(() => localKeySignerAdapterFor(scope)).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() => localKeySignerAdapterFor(scope)).toThrow(
            'No local-key signer adapter is registered for chain "algorand"',
        )
    })

    it('refuses a second adapter for the same chain', () => {
        registerFakeLocalKeySignerAdapter()

        expect(() =>
            localKeySignerChainAdapters.register(fakeLocalKeySignerAdapter()),
        ).toThrow(DuplicateChainAdapterError)
    })
})
