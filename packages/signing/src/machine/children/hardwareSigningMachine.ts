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
import { config } from '@perawallet/wallet-core-config'
import type {
    HardwareSigningContext,
    HardwareSigningEvent,
    HardwareSigningInput,
    HardwareSigningOutput,
} from './hardwareSigningMachine.context'
import { hardwareSignActor } from './hardwareSignActor'

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
    // Generous machine-level ceiling for the long-lived `active` substates
    // (searching / awaiting_approval) so a hung hardware-signing step cannot
    // pin the signing UI indefinitely. Reuses the parent machine's transport
    // ceiling from config so the value stays tunable and never hardcoded.
    delays: {
        HARDWARE_TIMEOUT: config.signingTransportTimeout,
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
        clearError: assign({
            error: () => null,
            currentTx: () => 0,
        }),
        // Fired by the `active` state's `after` timeout. There is no
        // `event.error` on an `after` transition, so we synthesize a
        // retryable-shaped hardware error with kind `'timeout'`. Routing this
        // into the existing `error` state means RETRY (→ active) and
        // ACKNOWLEDGE_ERROR (→ done) work unchanged for a timed-out step.
        setTimeoutError: assign({
            error: () => ({
                kind: 'timeout' as const,
                cause: new Error(
                    `Hardware signing timed out after ${config.signingTransportTimeout}ms`,
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
                searching: {
                    on: {
                        AWAITING_APPROVAL: 'awaiting_approval',
                        SIGNING_STARTED: 'signing',
                    },
                },
                awaiting_approval: {
                    on: {
                        SIGNING_STARTED: 'signing',
                    },
                },
                signing: {
                    on: {
                        AWAITING_APPROVAL: 'awaiting_approval',
                    },
                },
            },
            on: {
                PROGRESS: { actions: 'updateProgress' },
                GROUP_SIGNED: { actions: 'appendResult' },
                STRATEGY_ERROR: { target: 'error', actions: 'setError' },
                // Non-device errors (e.g. ARC-60 validation) bypass the
                // BLE-class teardown gate — go straight to done with kind:
                // 'error' so the inline failure sheet surfaces immediately
                // instead of pinning the troubleshooting sheet open.
                NON_LEDGER_ERROR: { target: 'done', actions: 'setError' },
                ALL_DONE: 'done',
                USER_REJECTED_ON_DEVICE: 'rejected',
            },
            // Backstop timeout covering time spent in any `active` substate
            // (searching / awaiting_approval / signing). An `after` on the
            // parent `active` state is cancelled automatically on exit, so a
            // normal completion never trips it. Routes to the existing
            // retryable `error` state so the user can RETRY rather than stare
            // at an indefinite spinner.
            after: {
                HARDWARE_TIMEOUT: {
                    target: 'error',
                    actions: 'setTimeoutError',
                },
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
                ACKNOWLEDGE_ERROR: 'done',
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
