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
    ...mockDeps,
    ...overrides,
})

// =============================================================================
// Mocked machine (actors replaced for isolation)
// =============================================================================

const mockedMachine = signingMachine.provide({
    actors: {
        analyzerActor: fromPromise(async () => mockAnalysis),
        localKeySignerActor: fromPromise(async () => mockSigningResult),
        multisigSignerActor: fromPromise(async (): Promise<SigningResult> => {
            throw new Error('multisig not implemented')
        }),
        transportActor: fromPromise(async () => mockTransportResult),
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
        expect(state.context.signingResult).toEqual(mockSigningResult)
        expect(state.context.analysis).toEqual(mockAnalysis)
        expect(state.context.error).toBeNull()
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
        expect(state.context.error?.message).toMatch(/not found/i)
    })

    it('goes to failed when analyzer throws', async () => {
        const failingMachine = signingMachine.provide({
            actors: {
                analyzerActor: fromPromise(async () => {
                    throw new Error('analyzer failure')
                }),
                localKeySignerActor: fromPromise(async () => mockSigningResult),
                multisigSignerActor: fromPromise(
                    async (): Promise<SigningResult> => {
                        throw new Error('multisig not implemented')
                    },
                ),
                transportActor: fromPromise(async () => mockTransportResult),
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
                analyzerActor: fromPromise(async () => mockAnalysis),
                localKeySignerActor: fromPromise(
                    async (): Promise<SigningResult> => {
                        throw new Error('signing failure')
                    },
                ),
                multisigSignerActor: fromPromise(
                    async (): Promise<SigningResult> => {
                        throw new Error('multisig not implemented')
                    },
                ),
                transportActor: fromPromise(async () => mockTransportResult),
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
                analyzerActor: fromPromise(async () => mockAnalysis),
                localKeySignerActor: fromPromise(async () => mockSigningResult),
                multisigSignerActor: fromPromise(
                    async (): Promise<SigningResult> => {
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

    it('resolves signerAccount and authAccount in context', async () => {
        const actor = createActor(mockedMachine, { input: makeInput() })
        actor.start()

        const state = await waitFor(actor, s => s.matches('awaiting_user'))
        expect(state.context.signerAccount?.address).toBe(MOCK_ADDRESS)
        expect(state.context.authAccount?.address).toBe(MOCK_ADDRESS)
        expect(state.context.resolvedSignerType).toBe('localKey')
    })

    it('stores analysis in context after validating', async () => {
        const actor = createActor(mockedMachine, { input: makeInput() })
        actor.start()

        const state = await waitFor(actor, s => s.matches('awaiting_user'))
        expect(state.context.analysis).toEqual(mockAnalysis)
    })
})
