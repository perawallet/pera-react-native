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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createActor, fromPromise, waitFor } from 'xstate'
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
    authAddresses: new Map(),
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

    it('skips awaiting_user for headless requests and reaches completed', async () => {
        const headlessRequest: TransactionSignRequest = {
            ...mockRequest,
            id: 'req-headless',
            transport: 'callback',
            headless: true,
            approve: vi.fn().mockResolvedValue(undefined),
        }

        const actor = createActor(mockedMachine, {
            input: makeInput({ request: headlessRequest }),
        })

        const visited: string[] = []
        actor.subscribe(snapshot => {
            const value =
                typeof snapshot.value === 'string'
                    ? snapshot.value
                    : Object.keys(snapshot.value)[0]
            if (value && !visited.includes(value)) visited.push(value)
        })

        actor.start()

        const state = await waitFor(actor, s => s.matches('completed'))
        expect(state.matches('completed')).toBe(true)
        expect(visited).not.toContain('awaiting_user')
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
})
