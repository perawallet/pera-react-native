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
import type { SigningMachineContext, SigningMachineEvent, SigningMachineInput } from './context'
import type { AnalyzedSignableGroup } from '../pipeline/types'
import { analyzerActor } from './actors/analyzerActor'
import { localKeySignerActor } from './actors/signers/localKeySignerActor'
import { multisigSignerActor } from './actors/signers/multisigSignerActor'
import { transportActor } from './actors/transports/transportActor'
import { resolveInitialContext, makeFailedContext } from './actions'

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
        multisigSignerActor,
        transportActor,
    },
    guards: {
        hasError: ({ context }) => context.error !== null,
        isLocalKeyType: ({ context }) => context.resolvedSignerType === 'localKey',
        isMultisigType: ({ context }) => context.resolvedSignerType === 'multisig',
    },
}).createMachine({
    id: 'signingMachine',

    context: ({ input }) => {
        try {
            return resolveInitialContext(input)
        } catch (error) {
            return makeFailedContext(
                input,
                error instanceof Error ? error : new Error(String(error)),
            )
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
                    group: context.signableGroup!,
                    context: {
                        network: context.deps.network,
                        accounts: context.allAccounts,
                    },
                }),
                onDone: {
                    target: 'awaiting_user',
                    actions: assign({
                        analysis: ({ event }) => event.output,
                    }),
                },
                onError: {
                    target: 'failed',
                    actions: assign({
                        error: ({ event }) => {
                            const e = event.error
                            return e instanceof Error ? e : new Error(String(e))
                        },
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
         * Routes to the appropriate signer actor based on resolvedSignerType.
         * Ledger is handled by a sub-machine added in Phase 8.
         */
        signing: {
            initial: 'routing',
            states: {
                routing: {
                    always: [
                        { guard: 'isLocalKeyType', target: 'localKey' },
                        { guard: 'isMultisigType', target: 'multisig' },
                        // No valid signer type — should not happen if idle resolved correctly
                        { target: '#signingMachine.failed' },
                    ],
                },

                localKey: {
                    invoke: {
                        src: 'localKeySignerActor',
                        input: ({ context }) => ({
                            group: {
                                ...context.signableGroup!,
                                analysis: context.analysis!,
                            } as AnalyzedSignableGroup,
                            signerAccount: context.authAccount ?? context.signerAccount!,
                            signTransactions: context.deps.signTransactions,
                        }),
                        onDone: {
                            target: '#signingMachine.transporting',
                            actions: assign({
                                signingResult: ({ event }) => event.output,
                            }),
                        },
                        onError: {
                            target: '#signingMachine.failed',
                            actions: assign({
                                error: ({ event }) => {
                                    const e = event.error
                                    return e instanceof Error ? e : new Error(String(e))
                                },
                            }),
                        },
                    },
                },

                multisig: {
                    invoke: {
                        src: 'multisigSignerActor',
                        input: ({ context }) => ({
                            group: {
                                ...context.signableGroup!,
                                analysis: context.analysis!,
                            } as AnalyzedSignableGroup,
                            signerAccount: context.signerAccount!,
                        }),
                        onDone: {
                            target: '#signingMachine.transporting',
                            actions: assign({
                                signingResult: ({ event }) => event.output,
                            }),
                        },
                        onError: {
                            target: '#signingMachine.failed',
                            actions: assign({
                                error: ({ event }) => {
                                    const e = event.error
                                    return e instanceof Error ? e : new Error(String(e))
                                },
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
                    signingResult: context.signingResult!,
                    source: context.signableGroup!.source,
                    signerAccount: context.authAccount ?? context.signerAccount!,
                    jointAccountAddress: context.signerAccount?.address,
                    algokit: context.deps.algokit,
                    encodeSignedTransactions: context.deps.encodeSignedTransactions,
                    proposeSignRequest: context.deps.proposeSignRequest,
                    addSignatures: context.deps.addSignatures,
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
                        error: ({ event }) => {
                            const e = event.error
                            return e instanceof Error ? e : new Error(String(e))
                        },
                    }),
                },
            },
        },

        /** Signing and delivery succeeded. */
        completed: { type: 'final' },

        /** User cancelled the request. */
        rejected: { type: 'final' },

        /** An unrecoverable error occurred. */
        failed: { type: 'final' },
    },
})
