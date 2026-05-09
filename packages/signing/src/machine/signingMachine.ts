/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { setup, assign } from 'xstate'
import {
    toError,
    assertDefined,
    isRetryableError,
} from '@perawallet/wallet-core-shared'
import type {
    SigningMachineContext,
    SigningMachineEvent,
    SigningMachineInput,
    ResolvedSignerType,
} from './context'
import type {
    AnalyzedSignableGroup,
    SignableAnalysis,
    SigningResult,
    TransportResult,
} from '../pipeline/types'
import { analyzerActor } from './actors/analyzerActor'
import { localKeySignerActor } from './actors/signers/localKeySignerActor'
import { hardwareSignerActor } from './actors/signers/hardwareSignerActor'
import { multisigSignerActor } from './actors/signers/multisigSignerActor'
import { transportActor } from './actors/transports/transportActor'
import { LedgerUserRejectedError } from '@perawallet/wallet-core-ledger'
import { resolveInitialContext, makeFailedContext } from './actions'

/**
 * Returns the next signer type that hasn't been completed yet,
 * or undefined if all types are done (or groupSignerTypes is null).
 */
const getNextPendingSignerType = (
    context: SigningMachineContext,
): ResolvedSignerType | undefined => {
    if (!context.groupSignerTypes) return undefined
    const uniqueTypes = [...new Set(context.groupSignerTypes.values())]
    return uniqueTypes.find(t => !context.completedSignerTypes.includes(t))
}

/**
 * Builds the analyzed groups for a specific signer type by zipping
 * signableGroups with their analyses and filtering by the type map.
 * Used by each signer state's `input` to avoid duplicating this logic.
 */
const getAnalyzedGroupsForSignerType = (
    context: SigningMachineContext,
    signerType: ResolvedSignerType,
): AnalyzedSignableGroup[] => {
    const allGroups = assertDefined(context.signableGroups, 'signableGroups')
    const allAnalyses = assertDefined(context.analyses, 'analyses')
    const types = assertDefined(context.groupSignerTypes, 'groupSignerTypes')
    return allGroups
        .map((g, i) => ({ ...g, analysis: allAnalyses[i] }))
        .filter(
            g => types.get(g.signerAddress) === signerType,
        ) as AnalyzedSignableGroup[]
}

/**
 * Core signing state machine.
 *
 * States:
 *   idle        → immediately transitions to validating or failed (synchronous context resolution)
 *   validating  → analyzes the signable group (fees, warnings, risk level)
 *   awaiting_user → waits for USER_APPROVED or USER_REJECTED
 *   signing     → routes to localKey or multisig signer actor
 *   transporting → delivers signed data to the appropriate destination
 *   completed   → terminal: signing and delivery succeeded
 *   rejected    → terminal: user cancelled
 *   failed      → terminal: an error occurred
 */
export const signingMachine = setup({
    types: {
        context: {} as SigningMachineContext,
        events: {} as SigningMachineEvent,
        input: {} as SigningMachineInput,
    },
    actors: {
        analyzerActor,
        localKeySignerActor,
        hardwareSignerActor,
        multisigSignerActor,
        transportActor,
    },
    guards: {
        hasError: ({ context }) => context.error !== null,
        isHeadless: ({ context }) => context.request.headless === true,
        allGroupsSigned: ({ context }) =>
            getNextPendingSignerType(context) === undefined &&
            context.groupSignerTypes !== null,
        isNextSignerLocalKey: ({ context }) =>
            getNextPendingSignerType(context) === 'localKey',
        isNextSignerHardware: ({ context }) =>
            getNextPendingSignerType(context) === 'hardware',
        isNextSignerMultisig: ({ context }) =>
            getNextPendingSignerType(context) === 'multisig',
        isRetryable: ({ context }) => isRetryableError(context.error),
        isUserRejected: ({ context }) =>
            context.error instanceof LedgerUserRejectedError,
        canRetryValidating: ({ context }) =>
            isRetryableError(context.error) &&
            context.failedDuringState === 'validating',
        canRetrySigning: ({ context }) =>
            isRetryableError(context.error) &&
            context.failedDuringState === 'signing',
        canRetryTransporting: ({ context }) =>
            isRetryableError(context.error) &&
            context.failedDuringState === 'transporting',
    },
    /**
     * Named actions keep the machine body readable (states describe *what* to do,
     * actions describe *how* to update context). Each `event.output` access below
     * is the XState v5 way of reading an invoked actor's resolved Promise value.
     */
    actions: {
        // validating
        storeAnalyses: assign({
            // event.output is the resolved value of the analyzerActor Promise
            analyses: ({ event }) =>
                (event as unknown as { output: SignableAnalysis[] }).output,
        }),
        setValidatingError: assign({
            error: ({ event }) =>
                toError((event as unknown as { error: unknown }).error),
            failedDuringState: () => 'validating' as const,
        }),

        // signing — one pair per signer type (onDone appends results, onError stores failure)
        appendLocalKeyResults: assign({
            // event.output is the resolved value of the localKeySignerActor Promise
            signingResults: ({ context, event }) => [
                ...(context.signingResults ?? []),
                ...(event as unknown as { output: SigningResult[] }).output,
            ],
            completedSignerTypes: ({ context }) => [
                ...context.completedSignerTypes,
                'localKey' as const,
            ],
        }),
        appendHardwareResults: assign({
            // event.output is the resolved value of the hardwareSignerActor Promise
            signingResults: ({ context, event }) => [
                ...(context.signingResults ?? []),
                ...(event as unknown as { output: SigningResult[] }).output,
            ],
            completedSignerTypes: ({ context }) => [
                ...context.completedSignerTypes,
                'hardware' as const,
            ],
        }),
        appendMultisigResults: assign({
            // event.output is the resolved value of the multisigSignerActor Promise
            signingResults: ({ context, event }) => [
                ...(context.signingResults ?? []),
                ...(event as unknown as { output: SigningResult[] }).output,
            ],
            completedSignerTypes: ({ context }) => [
                ...context.completedSignerTypes,
                'multisig' as const,
            ],
        }),
        setSigningError: assign({
            error: ({ event }) =>
                toError((event as unknown as { error: unknown }).error),
            failedDuringState: () => 'signing' as const,
        }),

        // transporting
        storeTransportResult: assign({
            // event.output is the resolved value of the transportActor Promise
            transportResult: ({ event }) =>
                (event as unknown as { output: TransportResult }).output,
        }),
        setTransportingError: assign({
            error: ({ event }) =>
                toError((event as unknown as { error: unknown }).error),
            failedDuringState: () => 'transporting' as const,
        }),

        // retry
        clearError: assign({
            error: () => null,
            failedDuringState: () => null,
        }),
        resetSigningState: assign({
            error: () => null,
            failedDuringState: () => null,
            completedSignerTypes: () => [],
            signingResults: () => null,
        }),
    },
}).createMachine({
    id: 'signingMachine',

    context: ({ input }) => {
        try {
            return resolveInitialContext(input)
        } catch (error) {
            return makeFailedContext(input, toError(error))
        }
    },

    initial: 'idle',

    states: {
        /**
         * Immediately transitions to validating or failed.
         * Context is already resolved in the `context` factory above.
         */
        idle: {
            always: [
                { guard: 'hasError', target: 'failed' },
                { target: 'validating' },
            ],
        },

        /**
         * Analyzes the signable group: calculates fees, detects warnings,
         * extracts signable addresses.
         *
         * Headless requests skip `awaiting_user` and proceed directly to
         * signing — the caller has already collected user intent on a
         * preceding screen.
         */
        validating: {
            invoke: {
                src: 'analyzerActor',
                input: ({ context }) => ({
                    groups: assertDefined(
                        context.signableGroups,
                        'signableGroups',
                    ),
                    context: {
                        network: context.deps.network,
                        accounts: context.allAccounts,
                    },
                }),
                onDone: [
                    {
                        guard: 'isHeadless',
                        target: 'signing',
                        actions: 'storeAnalyses',
                    },
                    {
                        target: 'awaiting_user',
                        actions: 'storeAnalyses',
                    },
                ],
                onError: {
                    target: 'failed',
                    actions: 'setValidatingError',
                },
            },
            on: {
                USER_REJECTED: 'rejected',
            },
        },

        /**
         * Waits for the user to confirm or reject the signing request.
         * The UI reads analysis from context to display fees, warnings, etc.
         */
        awaiting_user: {
            on: {
                USER_APPROVED: 'signing',
                USER_REJECTED: 'rejected',
            },
        },

        /**
         * Sequentially dispatches each signer type's groups to the appropriate actor.
         * `dispatching` picks the next pending type; each actor appends its results
         * and marks its type complete before returning to `dispatching`.
         * When all types are complete, transitions to `transporting`.
         */
        signing: {
            initial: 'dispatching',
            states: {
                dispatching: {
                    always: [
                        {
                            guard: 'allGroupsSigned',
                            target: '#signingMachine.transporting',
                        },
                        { guard: 'isNextSignerLocalKey', target: 'localKey' },
                        { guard: 'isNextSignerHardware', target: 'hardware' },
                        { guard: 'isNextSignerMultisig', target: 'multisig' },
                        // No pending signer type — should not happen
                        { target: '#signingMachine.failed' },
                    ],
                },

                localKey: {
                    invoke: {
                        src: 'localKeySignerActor',
                        input: ({ context }) => ({
                            groups: getAnalyzedGroupsForSignerType(
                                context,
                                'localKey',
                            ),
                            allAccounts: context.allAccounts,
                            signTransactions: context.deps.signTransactions,
                            signArbitraryData: context.deps.signArbitraryData,
                            signArc60: context.deps.signArc60,
                        }),
                        onDone: {
                            target: 'dispatching',
                            actions: 'appendLocalKeyResults',
                        },
                        onError: {
                            target: '#signingMachine.failed',
                            actions: 'setSigningError',
                        },
                    },
                },

                hardware: {
                    invoke: {
                        src: 'hardwareSignerActor',
                        input: ({ context }) => ({
                            groups: getAnalyzedGroupsForSignerType(
                                context,
                                'hardware',
                            ),
                            allAccounts: context.allAccounts,
                            hardwareWalletRegistry:
                                context.deps.hardwareWalletRegistry!,
                            encodeTransaction: context.deps.encodeTransaction,
                            callbacks: context.deps.signingCallbacks,
                        }),
                        onDone: {
                            target: 'dispatching',
                            actions: 'appendHardwareResults',
                        },
                        onError: [
                            {
                                guard: 'isUserRejected',
                                target: '#signingMachine.rejected',
                                actions: 'setSigningError',
                            },
                            {
                                target: '#signingMachine.failed',
                                actions: 'setSigningError',
                            },
                        ],
                    },
                },

                multisig: {
                    invoke: {
                        src: 'multisigSignerActor',
                        input: ({ context }) => ({
                            groups: getAnalyzedGroupsForSignerType(
                                context,
                                'multisig',
                            ),
                            allAccounts: context.allAccounts,
                        }),
                        onDone: {
                            target: 'dispatching',
                            actions: 'appendMultisigResults',
                        },
                        onError: {
                            target: '#signingMachine.failed',
                            actions: 'setSigningError',
                        },
                    },
                },
            },
        },

        /**
         * Delivers signed data to the appropriate destination:
         * algod, WalletConnect callback, or multisig backend.
         */
        transporting: {
            invoke: {
                src: 'transportActor',
                input: ({ context }) => ({
                    signingResults: assertDefined(
                        context.signingResults,
                        'signingResults',
                    ),
                    source: assertDefined(
                        context.signableGroups,
                        'signableGroups',
                    )[0].source,
                    signerAddress: assertDefined(
                        context.signerAddress,
                        'signerAddress',
                    ),
                    allAccounts: context.allAccounts,
                    createTransport: context.deps.createTransport,
                }),
                onDone: {
                    target: 'completed',
                    actions: 'storeTransportResult',
                },
                onError: {
                    target: 'failed',
                    actions: 'setTransportingError',
                },
            },
        },

        /** Signing and delivery succeeded. */
        completed: { type: 'final' },

        /** User cancelled the request. */
        rejected: { type: 'final' },

        /**
         * An error occurred. If the error is retryable, the user can send
         * RETRY to re-enter the stage that failed. Otherwise this is terminal.
         */
        failed: {
            on: {
                RETRY: [
                    {
                        guard: 'canRetryValidating',
                        target: 'validating',
                        actions: 'clearError',
                    },
                    {
                        guard: 'canRetrySigning',
                        target: 'signing',
                        actions: 'resetSigningState',
                    },
                    {
                        guard: 'canRetryTransporting',
                        target: 'transporting',
                        actions: 'clearError',
                    },
                ],
            },
        },
    },
})
