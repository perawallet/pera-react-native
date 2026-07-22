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

import { setup, assign } from 'xstate'
import {
    LEDGER_CONFIRMATION_TIMEOUT_MS,
    LEDGER_CONNECTION_TIMEOUT_MS,
} from '@perawallet/wallet-core-ledger'
import type {
    HardwareSigningContext,
    HardwareSigningEvent,
    HardwareSigningInput,
    HardwareSigningOutput,
} from './hardwareSigningMachine.context'
import { hardwareSignActor } from './hardwareSignActor'
import { appStateTracker } from './appStateTracker'

/**
 * Margin added on top of the strategy's own `withTimeout` ceilings so the
 * machine-side timers are pure backstops: the strategy's timeout always fires
 * first and surfaces as `STRATEGY_ERROR` with a precise error; the machine
 * timer only catches a step that hangs without ever settling its promise.
 */
const BACKSTOP_MARGIN_MS = 15_000

export const hardwareSigningMachine = setup({
    types: {
        context: {} as HardwareSigningContext,
        events: {} as HardwareSigningEvent,
        input: {} as HardwareSigningInput,
        output: {} as HardwareSigningOutput,
    },
    actors: {
        hardwareSignActor,
    },
    // Per-substate backstop budgets, derived from the same Ledger ceilings the
    // strategy's `withTimeout` calls use (never hardcoded ms):
    // - `searching` covers connect + address-verify — two sequential awaits
    //   each bounded by LEDGER_CONNECTION_TIMEOUT_MS — so its budget must
    //   exceed twice that ceiling or a slow-but-legal cold-start connect times
    //   the step out.
    // - `awaiting_approval`/`signing` are bounded by the on-device
    //   confirmation ceiling (LEDGER_CONFIRMATION_TIMEOUT_MS, 5 min): a single
    //   slow approval fires NO activity events, so the budget must sit above
    //   the strategy's own bound, which already fails the step via
    //   STRATEGY_ERROR. Activity events (PROGRESS / GROUP_SIGNED / a repeated
    //   AWAITING_APPROVAL) re-enter the substate and re-arm its timer.
    delays: {
        SEARCHING_TIMEOUT:
            2 * LEDGER_CONNECTION_TIMEOUT_MS + BACKSTOP_MARGIN_MS,
        APPROVAL_TIMEOUT: LEDGER_CONFIRMATION_TIMEOUT_MS + BACKSTOP_MARGIN_MS,
    },
    guards: {
        // iOS suspends JS timers while backgrounded, so a backstop that
        // expired in the background fires the instant the app resumes —
        // wall-clock elapsed that includes suspended time is not evidence
        // of a hung step. The AppState listener writes `backgroundedAt`
        // synchronously before suspension, so the guard swallows the stale
        // firing regardless of whether the listener's resume handling has
        // run yet; REARM_TIMERS then restores the backstop.
        isBackstopTrustworthy: () => appStateTracker.backgroundedAt === null,
    },
    actions: {
        appendResult: assign({
            results: ({ context, event }) => [
                ...context.results,
                (
                    event as Extract<
                        HardwareSigningEvent,
                        { type: 'GROUP_SIGNED' }
                    >
                ).result,
            ],
        }),
        updateProgress: assign({
            currentTx: ({ event }) =>
                (event as Extract<HardwareSigningEvent, { type: 'PROGRESS' }>)
                    .current,
        }),
        setError: assign({
            error: ({ event }) =>
                (
                    event as Extract<
                        HardwareSigningEvent,
                        { type: 'STRATEGY_ERROR' | 'NON_LEDGER_ERROR' }
                    >
                ).error,
        }),
        // RETRY re-invokes `hardwareSignActor` with ALL groups, so results
        // collected before the failure would re-fire and duplicate — clear
        // them along with the error. The user re-approves every group, but
        // the output can never contain a group twice.
        clearError: assign({
            error: () => null,
            currentTx: () => 0,
            results: () => [],
        }),
        // Fired by a substate's `after` backstop timeout. There is no
        // `event.error` on an `after` transition, so we synthesize a
        // retryable-shaped hardware error with kind `'timeout'`. Routing this
        // into the existing `error` state means RETRY (→ active) and
        // ACKNOWLEDGE_ERROR (→ done) work unchanged for a timed-out step.
        setTimeoutError: assign({
            error: () => ({
                kind: 'timeout' as const,
                cause: new Error('Hardware signing step timed out'),
            }),
        }),
        // Fired when the app stayed backgrounded past the grace window.
        // Routing into `error` (rather than `done`) keeps RETRY /
        // ACKNOWLEDGE_ERROR semantics — a fresh attempt reconnects the
        // device like any other retryable failure.
        setInterruptedError: assign({
            error: () => ({
                kind: 'interrupted' as const,
                cause: new Error(
                    'Hardware signing was interrupted while the app was in the background',
                ),
            }),
        }),
    },
}).createMachine({
    id: 'hardwareSigningMachine',
    initial: 'active',
    context: ({ input }) => ({
        ...input,
        currentTx: 0,
        error: null,
        results: [],
    }),
    // XState v5: root `output` must be defined for snapshot.output to surface.
    // Per-final-state `output` is delivered as `event.output` on the
    // `xstate.done.state.*` event for the completing final state; we pass it
    // through here so callers see the discriminated union directly.
    output: ({ event }) => (event as { output: HardwareSigningOutput }).output,
    states: {
        /**
         * Strategy is running. Inner state value tracks the live sub-phase
         * (searching → awaiting_approval → signing) driven by callback events.
         */
        active: {
            invoke: {
                src: 'hardwareSignActor',
                input: ({ context }) => context,
            },
            initial: 'searching',
            states: {
                // Each substate arms its OWN backstop timer on entry. Because
                // the timer lives on the substate and NOT on `active`, moving
                // between steps re-arms it without re-invoking
                // `hardwareSignActor` (the invoke is on `active`). Activity
                // events (PROGRESS / GROUP_SIGNED / a repeated
                // AWAITING_APPROVAL while already awaiting) are external
                // self-transitions: they exit and re-enter the substate, which
                // cancels and re-schedules its `after`. The budgets sit above
                // the strategy's own `withTimeout` ceilings, so a legitimate
                // slow step (cold-start connect, a user reading a multi-screen
                // approval) is never raced by the machine — only a step whose
                // promise hangs without settling reaches `error` this way.
                searching: {
                    on: {
                        AWAITING_APPROVAL: 'awaiting_approval',
                        SIGNING_STARTED: 'signing',
                        PROGRESS: {
                            target: 'searching',
                            reenter: true,
                            actions: 'updateProgress',
                        },
                        GROUP_SIGNED: {
                            target: 'searching',
                            reenter: true,
                            actions: 'appendResult',
                        },
                        REARM_TIMERS: {
                            target: 'searching',
                            reenter: true,
                        },
                    },
                    after: {
                        SEARCHING_TIMEOUT: {
                            guard: 'isBackstopTrustworthy',
                            target: '#hardwareSigningMachine.error',
                            actions: 'setTimeoutError',
                        },
                    },
                },
                awaiting_approval: {
                    on: {
                        SIGNING_STARTED: 'signing',
                        // A multi-tx group re-fires AWAITING_APPROVAL per
                        // signable tx while already in this step — re-enter to
                        // re-arm the per-step timer rather than let a single
                        // budget span every on-device approval.
                        AWAITING_APPROVAL: {
                            target: 'awaiting_approval',
                            reenter: true,
                        },
                        PROGRESS: {
                            target: 'awaiting_approval',
                            reenter: true,
                            actions: 'updateProgress',
                        },
                        GROUP_SIGNED: {
                            target: 'awaiting_approval',
                            reenter: true,
                            actions: 'appendResult',
                        },
                        REARM_TIMERS: {
                            target: 'awaiting_approval',
                            reenter: true,
                        },
                    },
                    after: {
                        APPROVAL_TIMEOUT: {
                            guard: 'isBackstopTrustworthy',
                            target: '#hardwareSigningMachine.error',
                            actions: 'setTimeoutError',
                        },
                    },
                },
                signing: {
                    on: {
                        AWAITING_APPROVAL: 'awaiting_approval',
                        PROGRESS: {
                            target: 'signing',
                            reenter: true,
                            actions: 'updateProgress',
                        },
                        GROUP_SIGNED: {
                            target: 'signing',
                            reenter: true,
                            actions: 'appendResult',
                        },
                        REARM_TIMERS: {
                            target: 'signing',
                            reenter: true,
                        },
                    },
                    after: {
                        APPROVAL_TIMEOUT: {
                            guard: 'isBackstopTrustworthy',
                            target: '#hardwareSigningMachine.error',
                            actions: 'setTimeoutError',
                        },
                    },
                },
            },
            on: {
                STRATEGY_ERROR: { target: 'error', actions: 'setError' },
                INTERRUPTED_BY_BACKGROUND: {
                    target: 'error',
                    actions: 'setInterruptedError',
                },
                // Non-device errors (e.g. ARC-60 validation) bypass the
                // BLE-class teardown gate — go straight to done with kind:
                // 'error' so the inline failure sheet surfaces immediately
                // instead of pinning the troubleshooting sheet open.
                NON_LEDGER_ERROR: { target: 'done', actions: 'setError' },
                ALL_DONE: 'done',
                USER_REJECTED_ON_DEVICE: 'rejected',
            },
        },

        /**
         * Terminal-ish: the parent cannot proceed until ACKNOWLEDGE_ERROR or RETRY
         * arrives. This is the machine-level encoding of the BLE-class teardown
         * carveout that previously lived as a runtime check in
         * useSigningActorLifecycle.ts.
         */
        error: {
            on: {
                RETRY: { target: 'active', actions: 'clearError' },
                ACKNOWLEDGE_ERROR: [
                    // An on-device reject IS a user cancel: the error sheet
                    // still offers Retry (a device reject is often a
                    // mis-press), but Cancel resolves the request via the
                    // rejected path — request.reject(), each feature's cancel
                    // UX — never as a failure that fires request.error().
                    {
                        guard: ({ context }) =>
                            context.error?.kind === 'user_rejected',
                        target: 'rejected',
                    },
                    { target: 'done' },
                ],
            },
        },

        rejected: {
            type: 'final',
            output: () => ({ kind: 'rejected' as const }),
        },

        done: {
            type: 'final',
            output: ({ context }) =>
                context.error
                    ? { kind: 'error' as const, error: context.error }
                    : { kind: 'success' as const, results: context.results },
        },
    },
})
