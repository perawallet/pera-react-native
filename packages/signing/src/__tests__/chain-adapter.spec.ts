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
    classifyHandoffPoll,
    classifyRequestStructure,
    completeMultisigHandoff,
    computeBalanceImpact,
    createTransactionListItems,
    decodeArbitraryDataForDisplay,
    encodeProgramAccount,
    getRekeyedUnsignableReason,
    isSignRequestMultisigUnsignable,
    legacyPlannerAdapter,
    localKeySignerAdapterFor,
    localKeySignerChainAdapters,
    plannerAdapterFor,
    plannerChainAdapters,
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

    it('delegates the network-less completion and unsignable checks to the registered planner', async () => {
        const adapter = registerFakePlannerAdapter({
            completeMultisigHandoff: vi.fn().mockResolvedValue(undefined),
            isSignRequestMultisigUnsignable: vi.fn(() => true),
        })
        const args = {
            outcome: { kind: 'soft-reject', reason: 'declined' },
            deps: {},
        } as unknown as Parameters<typeof completeMultisigHandoff>[0]

        await completeMultisigHandoff(args)

        expect(adapter.completeMultisigHandoff).toHaveBeenCalledWith(args)
        expect(isSignRequestMultisigUnsignable({} as never, [])).toBe(true)
        expect(adapter.isSignRequestMultisigUnsignable).toHaveBeenCalledWith(
            {},
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
