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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createActor, fromPromise, waitFor, setup } from 'xstate'
import { AppError } from '@perawallet/wallet-core-shared'
import { signingMachine } from '../signingMachine'
import type { SigningMachineInput } from '../context'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    SignableAnalysis,
    SigningResult,
    TransportResult,
} from '../../pipeline/types'
import type { TransactionSignRequest } from '../../models'

// =============================================================================
// Fixtures
// =============================================================================

const MOCK_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const mockAlgo25Account: WalletAccount = {
    type: 'algo25',
    address: MOCK_ADDRESS,
    keyPairId: 'key-1',
} as unknown as WalletAccount

const mockTx = {
    sender: { toString: () => MOCK_ADDRESS },
    fee: 1000n,
    type: 'pay',
} as never

const mockRequest: TransactionSignRequest = {
    id: 'req-1',
    type: 'transactions',
    transport: 'algod',
    txs: [mockTx],
}

const mockAnalysis: SignableAnalysis = {
    totalFees: 1000n,
    transactionSummaries: [],
    warnings: [],
    signableAddresses: [MOCK_ADDRESS],
    riskLevel: 'low',
}

const mockSigningResult: SigningResult = {
    signedData: { type: 'transactions', signed: [] },
    signers: [{ address: MOCK_ADDRESS }],
}

const mockTransportResult: TransportResult = {
    type: 'submitted',
    txIds: ['mock-tx-id'],
}

const mockDeps = {
    signTransactions: vi.fn(),
    signArbitraryData: vi.fn(),
    signArc60: vi.fn(),
    encodeSignedTransactions: vi
        .fn()
        .mockReturnValue([new Uint8Array([1, 2, 3])]),
    algokit: {
        client: {
            algod: {
                sendRawTransaction: vi
                    .fn()
                    .mockResolvedValue({ txid: 'mock-tx-id' }),
            },
        },
    },
    proposeSignRequest: vi.fn(),
    addSignatures: vi.fn(),
    network: 'mainnet' as never,
}

const makeInput = (
    overrides?: Partial<SigningMachineInput>,
): SigningMachineInput => ({
    request: mockRequest,
    allAccounts: [mockAlgo25Account],
    ...mockDeps,
    ...overrides,
})

// =============================================================================
// Mocked machine (actors replaced for isolation)
// =============================================================================

const mockedMachine = signingMachine.provide({
    actors: {
        analyzerActor: fromPromise(
            async (): Promise<SignableAnalysis[]> => [mockAnalysis],
        ),
        localKeySignerActor: fromPromise(
            async (): Promise<SigningResult[]> => [mockSigningResult],
        ),
        multisigSignerActor: fromPromise(async (): Promise<SigningResult[]> => {
            throw new Error('multisig not implemented')
        }),
        transportActor: fromPromise(
            async (): Promise<TransportResult> => mockTransportResult,
        ),
    },
})

// =============================================================================
// Tests
// =============================================================================

describe('signingMachine', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('reaches completed for a localKey account via algod', async () => {
        const actor = createActor(mockedMachine, { input: makeInput() })
        actor.start()

        await waitFor(actor, s => s.matches('awaiting_user'))
        actor.send({ type: 'USER_APPROVED' })

        const state = await waitFor(actor, s => s.matches('completed'))

        expect(state.context.transportResult).toEqual(mockTransportResult)
        expect(state.context.signingResults).toEqual([mockSigningResult])
        expect(state.context.analyses).toEqual([mockAnalysis])
        expect(state.context.error).toBeNull()
    })

    it('pauses at awaiting_user even for non-interactive transports — caller drives resume', async () => {
        // Post-PERA-XXXX the machine has no UI knowledge: every request
        // reaches `awaiting_user` and only resumes when the lifecycle
        // forwards an approval (instantly for non-interactive flows, after
        // the user slides to confirm for `INTERACTIVE_SOURCES`).
        const nonInteractiveRequest: TransactionSignRequest = {
            ...mockRequest,
            id: 'req-non-interactive',
            transport: 'callback',
            approve: vi.fn().mockResolvedValue(undefined),
        }

        const actor = createActor(mockedMachine, {
            input: makeInput({ request: nonInteractiveRequest }),
        })

        actor.start()

        const awaitingState = await waitFor(actor, s =>
            s.matches('awaiting_user'),
        )
        expect(awaitingState.matches('awaiting_user')).toBe(true)

        actor.send({ type: 'USER_APPROVED' })
        const completedState = await waitFor(actor, s => s.matches('completed'))
        expect(completedState.matches('completed')).toBe(true)
    })

    it('requires USER_APPROVED before signing — stays in awaiting_user', async () => {
        const actor = createActor(mockedMachine, { input: makeInput() })
        actor.start()

        const awaitingState = await waitFor(actor, s =>
            s.matches('awaiting_user'),
        )
        expect(awaitingState.matches('awaiting_user')).toBe(true)
    })

    it('reaches rejected when USER_REJECTED is sent', async () => {
        const actor = createActor(mockedMachine, { input: makeInput() })
        actor.start()

        await waitFor(actor, s => s.matches('awaiting_user'))
        actor.send({ type: 'USER_REJECTED' })

        const state = await waitFor(actor, s => s.matches('rejected'))
        expect(state.matches('rejected')).toBe(true)
    })

    it('honors USER_REJECTED while still in validating (cancel during analyzer run)', async () => {
        // Regression: previously USER_REJECTED was only handled in
        // awaiting_user. A cancel pressed while the analyzer was still
        // running was silently dropped, leaving the actor alive and the
        // single-flight queue blocked for every subsequent request.
        const slowMachine = signingMachine.provide({
            actors: {
                analyzerActor: fromPromise(
                    () =>
                        new Promise<SignableAnalysis[]>(resolve => {
                            // Never resolves on its own — only the
                            // USER_REJECTED transition can move the
                            // machine out of validating.
                            setTimeout(() => resolve([mockAnalysis]), 60_000)
                        }),
                ),
                localKeySignerActor: fromPromise(
                    async (): Promise<SigningResult[]> => [mockSigningResult],
                ),
                multisigSignerActor: fromPromise(
                    async (): Promise<SigningResult[]> => [],
                ),
                transportActor: fromPromise(
                    async (): Promise<TransportResult> => mockTransportResult,
                ),
            },
        })

        const actor = createActor(slowMachine, { input: makeInput() })
        actor.start()

        await waitFor(actor, s => s.matches('validating'))
        actor.send({ type: 'USER_REJECTED' })

        const state = await waitFor(actor, s => s.matches('rejected'))
        expect(state.matches('rejected')).toBe(true)
    })

    it('reaches completed after USER_APPROVED', async () => {
        const actor = createActor(mockedMachine, { input: makeInput() })
        actor.start()

        await waitFor(actor, s => s.matches('awaiting_user'))
        actor.send({ type: 'USER_APPROVED' })

        const state = await waitFor(actor, s => s.matches('completed'))
        expect(state.matches('completed')).toBe(true)
    })

    it('goes to failed immediately when signer account is not found', async () => {
        const actor = createActor(mockedMachine, {
            input: makeInput({ allAccounts: [] }), // no matching account
        })
        actor.start()

        const state = await waitFor(actor, s => s.matches('failed'))
        expect(state.context.error?.message).toMatch(/no signable/i)
    })

    it('goes to failed when analyzer throws', async () => {
        const failingMachine = signingMachine.provide({
            actors: {
                analyzerActor: fromPromise(
                    async (): Promise<SignableAnalysis[]> => {
                        throw new Error('analyzer failure')
                    },
                ),
                localKeySignerActor: fromPromise(
                    async (): Promise<SigningResult[]> => [mockSigningResult],
                ),
                multisigSignerActor: fromPromise(
                    async (): Promise<SigningResult[]> => {
                        throw new Error('multisig not implemented')
                    },
                ),
                transportActor: fromPromise(
                    async (): Promise<TransportResult> => mockTransportResult,
                ),
            },
        })

        const actor = createActor(failingMachine, { input: makeInput() })
        actor.start()

        const state = await waitFor(actor, s => s.matches('failed'))
        expect(state.context.error?.message).toMatch(/analyzer failure/)
    })

    it('goes to failed when signer throws', async () => {
        const failingMachine = signingMachine.provide({
            actors: {
                analyzerActor: fromPromise(
                    async (): Promise<SignableAnalysis[]> => [mockAnalysis],
                ),
                localKeySignerActor: fromPromise(
                    async (): Promise<SigningResult[]> => {
                        throw new Error('signing failure')
                    },
                ),
                multisigSignerActor: fromPromise(
                    async (): Promise<SigningResult[]> => {
                        throw new Error('multisig not implemented')
                    },
                ),
                transportActor: fromPromise(
                    async (): Promise<TransportResult> => mockTransportResult,
                ),
            },
        })

        const actor = createActor(failingMachine, { input: makeInput() })
        actor.start()

        await waitFor(actor, s => s.matches('awaiting_user'))
        actor.send({ type: 'USER_APPROVED' })

        const state = await waitFor(actor, s => s.matches('failed'))
        expect(state.context.error?.message).toMatch(/signing failure/)
    })

    it('transitions to rejected (terminal) when USER_REJECTED is sent from failed state', async () => {
        // Red-green: before the fix, USER_REJECTED was not handled in `failed`
        // and the actor would remain alive, blocking the single-flight queue.
        const actor = createActor(mockedMachine, {
            input: makeInput({ allAccounts: [] }), // triggers immediate failed
        })
        actor.start()

        await waitFor(actor, s => s.matches('failed'))

        actor.send({ type: 'USER_REJECTED' })

        const state = await waitFor(actor, s => s.matches('rejected'))
        expect(state.matches('rejected')).toBe(true)
        expect(actor.getSnapshot().status).toBe('done')
    })

    it('goes to failed when transport throws', async () => {
        const failingMachine = signingMachine.provide({
            actors: {
                analyzerActor: fromPromise(
                    async (): Promise<SignableAnalysis[]> => [mockAnalysis],
                ),
                localKeySignerActor: fromPromise(
                    async (): Promise<SigningResult[]> => [mockSigningResult],
                ),
                multisigSignerActor: fromPromise(
                    async (): Promise<SigningResult[]> => {
                        throw new Error('multisig not implemented')
                    },
                ),
                transportActor: fromPromise(
                    async (): Promise<TransportResult> => {
                        throw new Error('network error')
                    },
                ),
            },
        })

        const actor = createActor(failingMachine, { input: makeInput() })
        actor.start()

        await waitFor(actor, s => s.matches('awaiting_user'))
        actor.send({ type: 'USER_APPROVED' })

        const state = await waitFor(actor, s => s.matches('failed'))
        expect(state.context.error?.message).toMatch(/network error/)
    })

    it('resolves signerAddress and groupSignerTypes in context', async () => {
        const actor = createActor(mockedMachine, { input: makeInput() })
        actor.start()

        const state = await waitFor(actor, s => s.matches('awaiting_user'))
        expect(state.context.signerAddress).toBe(MOCK_ADDRESS)
        expect(state.context.groupSignerTypes?.get(MOCK_ADDRESS)).toBe(
            'localKey',
        )
    })

    it('stores analyses in context after validating', async () => {
        const actor = createActor(mockedMachine, { input: makeInput() })
        actor.start()

        const state = await waitFor(actor, s => s.matches('awaiting_user'))
        expect(state.context.analyses).toEqual([mockAnalysis])
    })

    it('uses signerOverrides to determine signer instead of tx.sender', async () => {
        // Simulates a WalletConnect request where the tx sender is a contract
        // but the actual signer (from ARC-0001 signers field) is the user
        const CONTRACT_ADDRESS =
            'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'

        const contractTx = {
            sender: { toString: () => CONTRACT_ADDRESS },
            fee: 1000n,
            type: 'pay',
        } as never

        const requestWithOverride: TransactionSignRequest = {
            id: 'req-override',
            type: 'transactions',
            transport: 'callback',
            txs: [contractTx],
            signerOverrides: new Map([[0, MOCK_ADDRESS]]),
        }

        const actor = createActor(mockedMachine, {
            input: makeInput({ request: requestWithOverride }),
        })
        actor.start()

        const state = await waitFor(actor, s => s.matches('awaiting_user'))

        // signerAddress should be the override (user), not the contract sender
        expect(state.context.signerAddress).toBe(MOCK_ADDRESS)
        expect(state.context.groupSignerTypes?.get(MOCK_ADDRESS)).toBe(
            'localKey',
        )
        // The group should use the overridden address
        expect(state.context.signableGroups?.[0]?.signerAddress).toBe(
            MOCK_ADDRESS,
        )
    })

    it('filters out contract-sender transactions for external sources', async () => {
        const CONTRACT_ADDRESS =
            'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'

        const contractTx = {
            sender: { toString: () => CONTRACT_ADDRESS },
            fee: 1000n,
            type: 'pay',
        } as never

        // External source (webview) sends mixed group: user tx + contract tx
        const mixedRequest: TransactionSignRequest = {
            id: 'req-mixed-external',
            type: 'transactions',
            transport: 'callback',
            sourceType: 'webview',
            txs: [mockTx, contractTx, mockTx],
        }

        const actor = createActor(mockedMachine, {
            input: makeInput({ request: mixedRequest }),
        })
        actor.start()

        const state = await waitFor(actor, s => s.matches('awaiting_user'))

        // Contract tx should be filtered out, only user txs remain
        expect(state.context.signableGroups).toHaveLength(1)
        expect(state.context.signableGroups?.[0]?.signerAddress).toBe(
            MOCK_ADDRESS,
        )
        // originalIndices should map to positions 0 and 2 (skipping 1)
        expect(state.context.signableGroups?.[0]?.originalIndices).toEqual([
            0, 2,
        ])
    })

    it('fails when all transactions have unknown senders for external sources', async () => {
        const CONTRACT_ADDRESS =
            'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'

        const contractTx = {
            sender: { toString: () => CONTRACT_ADDRESS },
            fee: 1000n,
            type: 'pay',
        } as never

        const allContractRequest: TransactionSignRequest = {
            id: 'req-all-contract',
            type: 'transactions',
            transport: 'callback',
            sourceType: 'webview',
            txs: [contractTx],
        }

        const actor = createActor(mockedMachine, {
            input: makeInput({ request: allContractRequest }),
        })
        actor.start()

        const state = await waitFor(actor, s => s.matches('failed'))
        expect(state.context.error?.message).toMatch(/no signable/i)
    })

    it('preserves error for unknown sender in local source requests', async () => {
        // Local sources should still throw — unknown sender is a bug
        const UNKNOWN_ADDRESS =
            'UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU'

        const unknownTx = {
            sender: { toString: () => UNKNOWN_ADDRESS },
            fee: 1000n,
            type: 'pay',
        } as never

        const localRequest: TransactionSignRequest = {
            id: 'req-local-unknown',
            type: 'transactions',
            transport: 'algod',
            // sourceType defaults to 'local' when absent
            txs: [unknownTx],
        }

        const actor = createActor(mockedMachine, {
            input: makeInput({ request: localRequest }),
        })
        actor.start()

        const state = await waitFor(actor, s => s.matches('failed'))
        expect(state.context.error?.message).toMatch(/no signable/i)
    })

    it('signs groups sequentially for a mixed localKey + multisig request', async () => {
        const MULTISIG_ADDRESS =
            'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

        const mockMultisigAccount: WalletAccount = {
            type: 'multisig',
            address: MULTISIG_ADDRESS,
        } as unknown as WalletAccount

        const mockTxFromMultisig = {
            sender: { toString: () => MULTISIG_ADDRESS },
            fee: 1000n,
            type: 'pay',
        } as never

        const mixedRequest: TransactionSignRequest = {
            id: 'req-mixed',
            type: 'transactions',
            transport: 'algod',
            txs: [mockTx, mockTxFromMultisig],
        }

        const localKeyResult: SigningResult = {
            signedData: { type: 'transactions', signed: [] },
            signers: [{ address: MOCK_ADDRESS }],
            originalIndices: [0],
        }
        const multisigResult: SigningResult = {
            signedData: { type: 'transactions', signed: [] },
            signers: [{ address: MULTISIG_ADDRESS }],
            originalIndices: [1],
        }

        let capturedLocalKeyGroups: { signerAddress: string }[] = []
        let capturedMultisigGroups: { signerAddress: string }[] = []

        const mixedMachine = signingMachine.provide({
            actors: {
                analyzerActor: fromPromise(
                    async (): Promise<SignableAnalysis[]> => [
                        mockAnalysis,
                        mockAnalysis,
                    ],
                ),
                localKeySignerActor: fromPromise(
                    async ({ input }): Promise<SigningResult[]> => {
                        capturedLocalKeyGroups = (
                            input as { groups: { signerAddress: string }[] }
                        ).groups
                        return [localKeyResult]
                    },
                ),
                multisigSignerActor: fromPromise(
                    async ({ input }): Promise<SigningResult[]> => {
                        capturedMultisigGroups = (
                            input as { groups: { signerAddress: string }[] }
                        ).groups
                        return [multisigResult]
                    },
                ),
                transportActor: fromPromise(
                    async (): Promise<TransportResult> => mockTransportResult,
                ),
            },
        })

        const actor = createActor(mixedMachine, {
            input: makeInput({
                request: mixedRequest,
                allAccounts: [mockAlgo25Account, mockMultisigAccount],
            }),
        })
        actor.start()

        await waitFor(actor, s => s.matches('awaiting_user'))
        actor.send({ type: 'USER_APPROVED' })

        const state = await waitFor(actor, s => s.matches('completed'))

        // localKeySignerActor received only the localKey group
        expect(capturedLocalKeyGroups).toHaveLength(1)
        expect(capturedLocalKeyGroups[0]?.signerAddress).toBe(MOCK_ADDRESS)

        // multisigSignerActor received only the multisig group
        expect(capturedMultisigGroups).toHaveLength(1)
        expect(capturedMultisigGroups[0]?.signerAddress).toBe(MULTISIG_ADDRESS)

        // Both results accumulated
        expect(state.context.signingResults).toHaveLength(2)
        expect(state.context.signingResults).toEqual(
            expect.arrayContaining([localKeyResult, multisigResult]),
        )
        expect(state.context.completedSignerTypes).toEqual(
            expect.arrayContaining(['localKey', 'multisig']),
        )
    })

    describe('transporting timeout', () => {
        // A transportActor that never resolves — models a hung submit that
        // would otherwise pin the signing UI indefinitely. The machine-level
        // `after: { SUBMIT_TIMEOUT }` must fire and route to `failed`.
        const makeHangingTransportMachine = (submitTimeoutMs: number) =>
            signingMachine.provide({
                actors: {
                    analyzerActor: fromPromise(
                        async (): Promise<SignableAnalysis[]> => [mockAnalysis],
                    ),
                    localKeySignerActor: fromPromise(
                        async (): Promise<SigningResult[]> => [
                            mockSigningResult,
                        ],
                    ),
                    multisigSignerActor: fromPromise(
                        async (): Promise<SigningResult[]> => {
                            throw new Error('multisig not implemented')
                        },
                    ),
                    transportActor: fromPromise(
                        () => new Promise<TransportResult>(() => {}),
                    ),
                },
                delays: { SUBMIT_TIMEOUT: submitTimeoutMs },
            })

        it('times out a hung transport and routes to failed, RETRY re-enters transporting', async () => {
            const actor = createActor(makeHangingTransportMachine(50), {
                input: makeInput(),
            })
            actor.start()

            await waitFor(actor, s => s.matches('awaiting_user'))
            actor.send({ type: 'USER_APPROVED' })
            await waitFor(actor, s => s.matches('transporting'))

            const failed = await waitFor(actor, s => s.matches('failed'), {
                timeout: 1000,
            })
            expect(failed.context.failedDuringState).toBe('transporting')

            // canRetryTransporting must hold → RETRY returns to transporting.
            actor.send({ type: 'RETRY' })
            const retried = await waitFor(
                actor,
                s => s.matches('transporting'),
                {
                    timeout: 1000,
                },
            )
            expect(retried.matches('transporting')).toBe(true)
        })

        it('sets a retryable network error when the transport times out', async () => {
            const actor = createActor(makeHangingTransportMachine(50), {
                input: makeInput(),
            })
            actor.start()

            await waitFor(actor, s => s.matches('awaiting_user'))
            actor.send({ type: 'USER_APPROVED' })

            const failed = await waitFor(actor, s => s.matches('failed'), {
                timeout: 1000,
            })
            const error = failed.context.error
            expect(error).toBeInstanceOf(AppError)
            expect((error as AppError).metadata.retryable).toBe(true)
        })

        it('does not fire the timeout when the transport completes quickly', async () => {
            // Regression: the `after` timer must be cancelled on a normal
            // transport resolution — a fast submit reaches `completed`.
            const actor = createActor(mockedMachine, { input: makeInput() })
            actor.start()

            await waitFor(actor, s => s.matches('awaiting_user'))
            actor.send({ type: 'USER_APPROVED' })

            const state = await waitFor(actor, s => s.matches('completed'), {
                timeout: 1000,
            })
            expect(state.context.error).toBeNull()
            expect(state.context.transportResult).toEqual(mockTransportResult)
        })
    })

    describe('hardware signer dispatch', () => {
        const HW_ADDRESS =
            'HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH'

        const hwAccount = {
            type: 'hardware',
            address: HW_ADDRESS,
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: 'device-1',
                deviceName: 'Nano X',
                accountIndex: 0,
                transportType: 'ble',
            },
        } as unknown as WalletAccount

        const hwTx = {
            sender: { toString: () => HW_ADDRESS },
            fee: 1000n,
            type: 'pay',
        } as never

        const hwRequest: TransactionSignRequest = {
            id: 'req-hw',
            type: 'transactions',
            transport: 'algod',
            txs: [hwTx],
        }

        const hwResult: SigningResult = {
            signedData: { type: 'transactions', signed: [] },
            signers: [{ address: HW_ADDRESS }],
            originalIndices: [0],
        }

        const inputForHardware = (): SigningMachineInput =>
            makeInput({
                request: hwRequest,
                allAccounts: [hwAccount],
                hardwareWalletRegistry: {} as never,
                encodeTransaction: vi.fn() as never,
            })

        // A controllable stand-in for hardwareSigningMachine that mirrors the
        // real child's state-value shape (active.{searching,awaiting_approval,
        // signing}). The test drives it event-by-event to simulate the real BLE
        // phase progression the device exhibits.
        const makeControllableHardwareChild = () =>
            setup({}).createMachine({
                id: 'mockHardwareChild',
                initial: 'active',
                states: {
                    active: {
                        initial: 'searching',
                        states: {
                            searching: {
                                on: { AWAITING_APPROVAL: 'awaiting_approval' },
                            },
                            awaiting_approval: {
                                on: { SIGNING_STARTED: 'signing' },
                            },
                            signing: {},
                        },
                    },
                },
            })

        type WithHardwareChild = {
            children: Record<
                string,
                {
                    send: (event: unknown) => void
                    getSnapshot: () => { value: unknown }
                }
            >
        }

        it('re-emits a parent snapshot when the hardware child transitions, so the overlay can update', async () => {
            const machine = signingMachine.provide({
                actors: {
                    analyzerActor: fromPromise(
                        async (): Promise<SignableAnalysis[]> => [mockAnalysis],
                    ),
                    hardwareSigningMachine:
                        makeControllableHardwareChild() as never,
                    transportActor: fromPromise(
                        async (): Promise<TransportResult> =>
                            mockTransportResult,
                    ),
                },
            })

            const actor = createActor(machine, { input: inputForHardware() })
            actor.start()
            await waitFor(actor, s => s.matches('awaiting_user'))
            actor.send({ type: 'USER_APPROVED' })

            // Wait until the hardware child has been invoked.
            await waitFor(actor, s =>
                Boolean(
                    (s as unknown as WithHardwareChild).children?.hardwareChild,
                ),
            )

            const child = (actor.getSnapshot() as unknown as WithHardwareChild)
                .children.hardwareChild

            // The parent stays in `signing.hardware` while the child advances
            // searching → awaiting_approval. XState v5 would NOT re-emit for
            // that child-only sub-state change on its own; the `onSnapshot`
            // nudge must force the parent to re-broadcast so the overlay's
            // parent subscription observes the new child phase. Capture every
            // parent emission and assert one of them reflects the child's new
            // phase.
            const observedChildPhases: unknown[] = []
            const subscription = actor.subscribe(snapshot => {
                observedChildPhases.push(
                    (
                        snapshot as unknown as WithHardwareChild
                    ).children?.hardwareChild?.getSnapshot?.()?.value,
                )
            })
            child.send({ type: 'AWAITING_APPROVAL' })
            subscription.unsubscribe()

            expect(observedChildPhases).toContainEqual({
                active: 'awaiting_approval',
            })
            // The re-emit surfaced the child change without altering the
            // parent's own state.
            expect(actor.getSnapshot().value).toEqual({ signing: 'hardware' })
        })

        it('hardware child success → results accumulated, machine completes', async () => {
            const machine = signingMachine.provide({
                actors: {
                    analyzerActor: fromPromise(
                        async (): Promise<SignableAnalysis[]> => [mockAnalysis],
                    ),
                    hardwareSigningMachine: fromPromise(async () => ({
                        kind: 'success' as const,
                        results: [hwResult],
                    })) as never,
                    transportActor: fromPromise(
                        async (): Promise<TransportResult> =>
                            mockTransportResult,
                    ),
                },
            })

            const actor = createActor(machine, { input: inputForHardware() })
            actor.start()
            await waitFor(actor, s => s.matches('awaiting_user'))
            actor.send({ type: 'USER_APPROVED' })

            const state = await waitFor(actor, s => s.matches('completed'))
            expect(state.context.signingResults).toEqual([hwResult])
            expect(state.context.completedSignerTypes).toContain('hardware')
        })

        it('hardware child rejected → machine reaches rejected state', async () => {
            const machine = signingMachine.provide({
                actors: {
                    analyzerActor: fromPromise(
                        async (): Promise<SignableAnalysis[]> => [mockAnalysis],
                    ),
                    hardwareSigningMachine: fromPromise(async () => ({
                        kind: 'rejected' as const,
                    })) as never,
                    transportActor: fromPromise(
                        async (): Promise<TransportResult> =>
                            mockTransportResult,
                    ),
                },
            })

            const actor = createActor(machine, { input: inputForHardware() })
            actor.start()
            await waitFor(actor, s => s.matches('awaiting_user'))
            actor.send({ type: 'USER_APPROVED' })

            const state = await waitFor(actor, s => s.matches('rejected'))
            expect(state.matches('rejected')).toBe(true)
        })

        it('hardware child error → machine reaches failed with the error cause', async () => {
            const cause = new Error('ledger bluetooth off')
            const machine = signingMachine.provide({
                actors: {
                    analyzerActor: fromPromise(
                        async (): Promise<SignableAnalysis[]> => [mockAnalysis],
                    ),
                    hardwareSigningMachine: fromPromise(async () => ({
                        kind: 'error' as const,
                        error: { kind: 'bluetooth_disabled', cause },
                    })) as never,
                    transportActor: fromPromise(
                        async (): Promise<TransportResult> =>
                            mockTransportResult,
                    ),
                },
            })

            const actor = createActor(machine, { input: inputForHardware() })
            actor.start()
            await waitFor(actor, s => s.matches('awaiting_user'))
            actor.send({ type: 'USER_APPROVED' })

            const state = await waitFor(actor, s => s.matches('failed'))
            expect(state.context.error).toBe(cause)
            expect(state.context.failedDuringState).toBe('signing')
        })
    })
})
