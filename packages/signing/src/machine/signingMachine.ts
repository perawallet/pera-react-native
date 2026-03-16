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
import type { AnalyzedSignableGroup } from '../pipeline/types'
import { analyzerActor } from './actors/analyzerActor'
import { localKeySignerActor } from './actors/signers/localKeySignerActor'
import { ledgerSignerActor } from './actors/signers/ledgerSignerActor'
import { multisigSignerActor } from './actors/signers/multisigSignerActor'
import { transportActor } from './actors/transports/transportActor'
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
        ledgerSignerActor,
        multisigSignerActor,
        transportActor,
    },
    guards: {
        hasError: ({ context }) => context.error !== null,
        allGroupsSigned: ({ context }) =>
            getNextPendingSignerType(context) === undefined &&
            context.groupSignerTypes !== null,
        isNextSignerLocalKey: ({ context }) =>
            getNextPendingSignerType(context) === 'localKey',
        isNextSignerLedger: ({ context }) =>
            getNextPendingSignerType(context) === 'ledger',
        isNextSignerMultisig: ({ context }) =>
            getNextPendingSignerType(context) === 'multisig',
        isRetryable: ({ context }) => isRetryableError(context.error),
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
                onDone: {
                    target: 'awaiting_user',
                    actions: assign({
                        analyses: ({ event }) => event.output,
                    }),
                },
                onError: {
                    target: 'failed',
                    actions: assign({
                        error: ({ event }) => toError(event.error),
                        failedDuringState: () => 'validating' as const,
                    }),
                },
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
                        { guard: 'isNextSignerLedger', target: 'ledger' },
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
                        }),
                        onDone: {
                            target: 'dispatching',
                            actions: assign({
                                signingResults: ({ context, event }) => [
                                    ...(context.signingResults ?? []),
                                    ...event.output,
                                ],
                                completedSignerTypes: ({ context }) => [
                                    ...context.completedSignerTypes,
                                    'localKey' as const,
                                ],
                            }),
                        },
                        onError: {
                            target: '#signingMachine.failed',
                            actions: assign({
                                error: ({ event }) => toError(event.error),
                                failedDuringState: () => 'signing' as const,
                            }),
                        },
                    },
                },

                ledger: {
                    invoke: {
                        src: 'ledgerSignerActor',
                        input: ({ context }) => ({
                            groups: getAnalyzedGroupsForSignerType(
                                context,
                                'ledger',
                            ),
                            allAccounts: context.allAccounts,
                        }),
                        onDone: {
                            target: 'dispatching',
                            actions: assign({
                                signingResults: ({ context, event }) => [
                                    ...(context.signingResults ?? []),
                                    ...event.output,
                                ],
                                completedSignerTypes: ({ context }) => [
                                    ...context.completedSignerTypes,
                                    'ledger' as const,
                                ],
                            }),
                        },
                        onError: {
                            target: '#signingMachine.failed',
                            actions: assign({
                                error: ({ event }) => toError(event.error),
                                failedDuringState: () => 'signing' as const,
                            }),
                        },
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
                            actions: assign({
                                signingResults: ({ context, event }) => [
                                    ...(context.signingResults ?? []),
                                    ...event.output,
                                ],
                                completedSignerTypes: ({ context }) => [
                                    ...context.completedSignerTypes,
                                    'multisig' as const,
                                ],
                            }),
                        },
                        onError: {
                            target: '#signingMachine.failed',
                            actions: assign({
                                error: ({ event }) => toError(event.error),
                                failedDuringState: () => 'signing' as const,
                            }),
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
                    actions: assign({
                        transportResult: ({ event }) => event.output,
                    }),
                },
                onError: {
                    target: 'failed',
                    actions: assign({
                        error: ({ event }) => toError(event.error),
                        failedDuringState: () => 'transporting' as const,
                    }),
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
                        actions: assign({
                            error: () => null,
                            failedDuringState: () => null,
                        }),
                    },
                    {
                        guard: 'canRetrySigning',
                        target: 'signing',
                        actions: assign({
                            error: () => null,
                            failedDuringState: () => null,
                            completedSignerTypes: () => [],
                            signingResults: () => null,
                        }),
                    },
                    {
                        guard: 'canRetryTransporting',
                        target: 'transporting',
                        actions: assign({
                            error: () => null,
                            failedDuringState: () => null,
                        }),
                    },
                ],
            },
        },
    },
})
