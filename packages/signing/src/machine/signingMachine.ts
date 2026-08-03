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

import { setup, assign, sendTo } from 'xstate'
import {
    toError,
    assertDefined,
    isRetryableError,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { config } from '@perawallet/wallet-core-config'
import { AlgodError } from '@perawallet/wallet-core-blockchain'
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
// Local-key and multisig are simple fromPromise actors. Hardware needs a
// child machine instead (own retry/error lifecycle, parent-forwarded events).
import { localKeySignerActor } from './actors/signers/localKeySignerActor'
import { quantumSignerActor } from './actors/signers/quantumSignerActor'
import { multisigSignerActor } from './actors/signers/multisigSignerActor'
import { transportActor } from './actors/transports/transportActor'
import { hardwareSigningMachine } from './children/hardwareSigningMachine'
import type { HardwareSigningOutput } from './children/hardwareSigningMachine.context'
import { resolveInitialContext, makeFailedContext } from './actions'
import { resolveHardwareDeviceName } from './utils/resolveHardwareDeviceName'
import { SigningError } from '../pipeline/errors'

/**
 * Returns the next signer type that hasn't been completed yet,
 * or undefined if all types are done (or groupSignerTypes is null).
 */
const getNextPendingSignerType = (
    context: SigningMachineContext,
): Optional<ResolvedSignerType> => {
    if (!context.groupSignerTypes) return undefined
    const uniqueTypes = [...new Set(context.groupSignerTypes.values())]
    return uniqueTypes.find(t => !context.completedSignerTypes.includes(t))
}

/** Zips signableGroups with their analyses, filtered by the type map. */
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
 * `idle` resolves context synchronously and transitions straight to `validating`
 * or `failed`; from there `awaiting_user` -> `signing` -> `transporting`, ending
 * in `completed`, `rejected` or `failed`.
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
        quantumSignerActor,
        hardwareSigningMachine,
        multisigSignerActor,
        transportActor,
    },
    // Ceiling on `transporting` so a hung submit can't pin the signing UI. Sits
    // above the transport request's own ceiling plus margin, so the
    // request-level abort normally fires first and this is only the backstop.
    delays: {
        SUBMIT_TIMEOUT: config.signingTransportTimeout,
    },
    guards: {
        hasError: ({ context }) => context.error !== null,
        allGroupsSigned: ({ context }) =>
            getNextPendingSignerType(context) === undefined &&
            context.groupSignerTypes !== null,
        isNextSignerLocalKey: ({ context }) =>
            getNextPendingSignerType(context) === 'localKey',
        isNextSignerQuantum: ({ context }) =>
            getNextPendingSignerType(context) === 'quantum',
        isNextSignerHardware: ({ context }) =>
            getNextPendingSignerType(context) === 'hardware' &&
            context.deps.hardwareWalletRegistry !== undefined,
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
    /** `event.output` is XState v5's way of reading an actor's resolved value. */
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
        appendQuantumResults: assign({
            // event.output is the resolved value of the quantumSignerActor Promise
            signingResults: ({ context, event }) => [
                ...(context.signingResults ?? []),
                ...(event as unknown as { output: SigningResult[] }).output,
            ],
            completedSignerTypes: ({ context }) => [
                ...context.completedSignerTypes,
                'quantum' as const,
            ],
        }),
        appendHardwareChildResults: assign({
            // event.output is the hardware child machine's `success` output.
            // The success guard on `onDone` runs before this action.
            signingResults: ({ context, event }) => [
                ...(context.signingResults ?? []),
                ...(
                    event as unknown as {
                        output: Extract<
                            HardwareSigningOutput,
                            { kind: 'success' }
                        >
                    }
                ).output.results,
            ],
            completedSignerTypes: ({ context }) => [
                ...context.completedSignerTypes,
                'hardware' as const,
            ],
        }),
        setHardwareChildError: assign({
            error: ({ event }) => {
                const out = (
                    event as unknown as {
                        output: Extract<
                            HardwareSigningOutput,
                            { kind: 'error' }
                        >
                    }
                ).output
                const cause: unknown = out.error.cause
                return cause instanceof Error ? cause : new Error(String(cause))
            },
            failedDuringState: () => 'signing' as const,
        }),
        // XState v5 parents stay silent on child-only sub-state changes, so this
        // counter nudges a re-broadcast. No data is copied up — the UI reads live
        // signer state from `resolved.activeChild`.
        bumpSignerSnapshotTick: assign({
            signerSnapshotTick: ({ context }) => context.signerSnapshotTick + 1,
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
        setDispatchingFallbackError: assign({
            error: () =>
                new SigningError(
                    'Signing dispatching reached an unresolvable state',
                ),
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
        // An `after` transition carries no `event.error`, so synthesize a
        // retryable `network_unavailable` AlgodError — that's what makes the
        // `failed` state's RETRY route back to `transporting`.
        setTransportTimeoutError: assign({
            error: () =>
                new AlgodError(
                    'network_unavailable',
                    {},
                    new Error(
                        `Transaction submit timed out after ${config.signingTransportTimeout}ms`,
                    ),
                ),
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
         * extracts signable addresses. Always transitions to `awaiting_user`
         * on success — the machine has no UI knowledge and treats that
         * state as a generic external sync point.
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
                    actions: 'storeAnalyses',
                },
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
         * External sync point between analysis and signing. The machine
         * pauses here unconditionally; the actor lifecycle decides whether
         * to resume immediately (headless callers — no gate registered) or
         * wait for a UI gate (interactive sources — gate registered by
         * the lifecycle at actor creation, resolved by user confirmation).
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
                        { guard: 'isNextSignerQuantum', target: 'quantum' },
                        { guard: 'isNextSignerHardware', target: 'hardware' },
                        { guard: 'isNextSignerMultisig', target: 'multisig' },
                        // No pending signer type — should not happen
                        {
                            target: '#signingMachine.failed',
                            actions: 'setDispatchingFallbackError',
                        },
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

                quantum: {
                    invoke: {
                        src: 'quantumSignerActor',
                        input: ({ context }) => ({
                            groups: getAnalyzedGroupsForSignerType(
                                context,
                                'quantum',
                            ),
                            allAccounts: context.allAccounts,
                            signQuantumTransactions:
                                context.deps.signQuantumTransactions,
                            signArbitraryData: context.deps.signArbitraryData,
                            signArc60: context.deps.signArc60,
                        }),
                        onDone: {
                            target: 'dispatching',
                            actions: 'appendQuantumResults',
                        },
                        onError: {
                            target: '#signingMachine.failed',
                            actions: 'setSigningError',
                        },
                    },
                },

                hardware: {
                    invoke: {
                        id: 'hardwareChild',
                        src: 'hardwareSigningMachine',
                        input: ({ context }) => {
                            const groups = getAnalyzedGroupsForSignerType(
                                context,
                                'hardware',
                            )
                            return {
                                groups,
                                allAccounts: context.allAccounts,
                                hardwareWalletRegistry: assertDefined(
                                    context.deps.hardwareWalletRegistry,
                                    'hardwareWalletRegistry',
                                ),
                                encodeTransaction:
                                    context.deps.encodeTransaction,
                                totalTxs: groups.reduce(
                                    (sum, g) =>
                                        sum +
                                        (g.data.type === 'transactions'
                                            ? g.data.transactions.length
                                            : 1),
                                    0,
                                ),
                                deviceName: resolveHardwareDeviceName(
                                    groups,
                                    context.allAccounts,
                                ),
                                // First group determines the operation kind
                                // (cosign requests don't mix arc60 + tx). The
                                // overlay reads this to pick context-aware copy.
                                operation:
                                    groups[0]?.data.type === 'arc60' ||
                                    groups[0]?.data.type === 'arbitrary-data'
                                        ? ('data' as const)
                                        : ('transaction' as const),
                            }
                        },
                        // Forces the parent to re-emit on every hardware child
                        // transition (searching → awaiting_approval → signing
                        // and each progress tick). Without this the parent stays
                        // silent during the device session and the overlay never
                        // advances past its first-seen phase. See
                        // `bumpSignerSnapshotTick`.
                        onSnapshot: { actions: 'bumpSignerSnapshotTick' },
                        onDone: [
                            {
                                guard: ({ event }) =>
                                    (event.output as HardwareSigningOutput)
                                        .kind === 'rejected',
                                target: '#signingMachine.rejected',
                            },
                            {
                                guard: ({ event }) =>
                                    (event.output as HardwareSigningOutput)
                                        .kind === 'error',
                                target: '#signingMachine.failed',
                                actions: 'setHardwareChildError',
                            },
                            {
                                target: 'dispatching',
                                actions: 'appendHardwareChildResults',
                            },
                        ],
                    },
                    on: {
                        // UI sends these to the parent; parent forwards to the
                        // child. The child owns its own error/retry lifecycle
                        // so the parent never observes intermediate failures.
                        USER_REJECTED: {
                            actions: sendTo('hardwareChild', {
                                type: 'USER_REJECTED_ON_DEVICE',
                            }),
                        },
                        RETRY_HARDWARE: {
                            actions: sendTo('hardwareChild', { type: 'RETRY' }),
                        },
                        ACKNOWLEDGE_HARDWARE_ERROR: {
                            actions: sendTo('hardwareChild', {
                                type: 'ACKNOWLEDGE_ERROR',
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
                            signTransactions: context.deps.signTransactions,
                            signQuantumTransactions:
                                context.deps.signQuantumTransactions,
                            signArbitraryData: context.deps.signArbitraryData,
                            signArc60: context.deps.signArc60,
                            encodeTransaction: context.deps.encodeTransaction,
                            hardwareWalletRegistry:
                                context.deps.hardwareWalletRegistry,
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
            // Backstop timeout: if the transport neither resolves nor errors
            // within the config ceiling, route to `failed` with a retryable
            // error so the user can RETRY (canRetryTransporting) rather than
            // stare at an indefinite spinner.
            after: {
                SUBMIT_TIMEOUT: {
                    target: 'failed',
                    actions: 'setTransportTimeoutError',
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
                USER_REJECTED: 'rejected',
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
