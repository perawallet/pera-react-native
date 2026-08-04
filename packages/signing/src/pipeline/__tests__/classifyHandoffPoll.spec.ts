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
    walletConnectHandoffs,
    type PendingWalletConnectHandoff,
} from '../walletConnectHandoffs'
import type { SignRequestResponse } from '@perawallet/wallet-core-multisig'

const { assembleMock, loggerWarnMock } = vi.hoisted(() => ({
    assembleMock: vi.fn(),
    loggerWarnMock: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return { ...actual, assembleSignedMultisigTransactions: assembleMock }
})

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        logger: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: loggerWarnMock,
            error: vi.fn(),
        },
    }
})

import {
    classifyHandoffPoll,
    errorReasonToMessage,
    resolveHandoffOutcome,
    type ResolverMessages,
} from '../classifyHandoffPoll'

const SIGN_REQUEST_ID = 'sr-1'

// Valid base64 of distinct byte strings — the classifier byte-compares the
// poll's raw transactions against the handoff's pinned (proposed) bytes
// before assembling.
const RAW_TX_B64 = btoa('raw-tx-1')
const OTHER_TX_B64 = btoa('attacker-tx')

const messages: ResolverMessages = {
    declined: 'msg.declined',
    expired: 'msg.expired',
    failed: 'msg.failed',
    noTransactions: 'msg.no_transactions',
    deliveryFailed: 'msg.delivery_failed',
    assemblyFailed: (reason: string) => `msg.assembly_failed:${reason}`,
}

const makeHandoff = (
    overrides: Partial<PendingWalletConnectHandoff> = {},
): PendingWalletConnectHandoff => ({
    signRequestId: SIGN_REQUEST_ID,
    multisigAddress: 'MSIG_ADDR',
    msigMetadata: { version: 1, threshold: 2, addresses: ['A', 'B', 'C'] },
    expectedRawTransactionsBase64: [RAW_TX_B64],
    deviceId: 'device-1',
    network: 'testnet',
    callbacks: {
        approveSignedBytes: vi.fn().mockResolvedValue(undefined),
        error: vi.fn().mockResolvedValue(undefined),
        reject: vi.fn().mockResolvedValue(undefined),
    },
    source: { type: 'walletconnect' },
    registeredAt: Date.now(),
    ...overrides,
})

// Minimal `with-signatures` detail — cast since the test controls the shape
// directly (no Zod validation runs against a mocked endpoint).
const makeDetail = (
    overrides: Record<string, unknown> = {},
): SignRequestResponse =>
    ({
        id: SIGN_REQUEST_ID,
        status: 'ready',
        fail_reason_display: null,
        transaction_lists: [
            {
                raw_transactions: [RAW_TX_B64],
                responses: [
                    { address: 'A', response: 'signed', signatures: ['sig-a'] },
                ],
            },
        ],
        ...overrides,
    }) as unknown as SignRequestResponse

describe('classifyHandoffPoll', () => {
    beforeEach(() => {
        assembleMock.mockReset()
    })

    it('keeps polling while status is pending', async () => {
        expect(
            await classifyHandoffPoll(
                makeDetail({ status: 'pending' }),
                makeHandoff(),
            ),
        ).toEqual({ kind: 'keep-polling' })
    })

    it('keeps polling while status is submitting', async () => {
        expect(
            await classifyHandoffPoll(
                makeDetail({ status: 'submitting' }),
                makeHandoff(),
            ),
        ).toEqual({ kind: 'keep-polling' })
    })

    it('keeps polling when a signed participant has no signatures yet', async () => {
        const outcome = await classifyHandoffPoll(
            makeDetail({
                status: 'ready',
                transaction_lists: [
                    {
                        raw_transactions: [RAW_TX_B64],
                        responses: [
                            {
                                address: 'A',
                                response: 'signed',
                                signatures: [],
                            },
                        ],
                    },
                ],
            }),
            makeHandoff(),
        )

        expect(outcome).toEqual({ kind: 'keep-polling' })
        expect(assembleMock).not.toHaveBeenCalled()
    })

    it('errors when a ready request carries no transaction lists', async () => {
        expect(
            await classifyHandoffPoll(
                makeDetail({ status: 'ready', transaction_lists: [] }),
                makeHandoff(),
            ),
        ).toEqual({ kind: 'error', reason: { kind: 'no-transactions' } })
    })

    it('returns ready with the assembled bytes when assembly succeeds', async () => {
        const signedBytes = [new Uint8Array([1, 2, 3])]
        assembleMock.mockReturnValue({
            kind: 'success',
            signedTransactionsBytes: signedBytes,
        })

        expect(await classifyHandoffPoll(makeDetail(), makeHandoff())).toEqual({
            kind: 'ready',
            assembledBytes: signedBytes,
        })
    })

    it('errors when assembly fails', async () => {
        assembleMock.mockReturnValue({ kind: 'error', reason: 'bad subsig' })

        expect(await classifyHandoffPoll(makeDetail(), makeHandoff())).toEqual({
            kind: 'error',
            reason: { kind: 'assembly-failed', detail: 'bad subsig' },
        })
    })

    it('refuses to assemble when the poll bytes differ from the proposed bytes', async () => {
        const outcome = await classifyHandoffPoll(
            makeDetail({
                transaction_lists: [
                    {
                        raw_transactions: [OTHER_TX_B64],
                        responses: [
                            {
                                address: 'A',
                                response: 'signed',
                                signatures: ['sig-a'],
                            },
                        ],
                    },
                ],
            }),
            makeHandoff(),
        )

        expect(outcome).toEqual({
            kind: 'error',
            reason: {
                kind: 'assembly-failed',
                detail: expect.stringMatching(/do not match/),
            },
        })
        expect(assembleMock).not.toHaveBeenCalled()
    })

    it('refuses to assemble when the poll carries extra transactions', async () => {
        const outcome = await classifyHandoffPoll(
            makeDetail({
                transaction_lists: [
                    {
                        raw_transactions: [RAW_TX_B64, OTHER_TX_B64],
                        responses: [
                            {
                                address: 'A',
                                response: 'signed',
                                signatures: ['sig-a', 'sig-a2'],
                            },
                        ],
                    },
                ],
            }),
            makeHandoff(),
        )

        expect(outcome).toEqual({
            kind: 'error',
            reason: {
                kind: 'assembly-failed',
                detail: expect.stringMatching(/do not match/),
            },
        })
        expect(assembleMock).not.toHaveBeenCalled()
    })

    it('refuses to assemble when the poll bytes are not decodable base64', async () => {
        const outcome = await classifyHandoffPoll(
            makeDetail({
                transaction_lists: [
                    {
                        raw_transactions: ['@@not-base64@@'],
                        responses: [
                            {
                                address: 'A',
                                response: 'signed',
                                signatures: ['sig-a'],
                            },
                        ],
                    },
                ],
            }),
            makeHandoff(),
        )

        expect(outcome).toEqual({
            kind: 'error',
            reason: {
                kind: 'assembly-failed',
                detail: expect.stringMatching(/do not match/),
            },
        })
        expect(assembleMock).not.toHaveBeenCalled()
    })

    it('classifies confirmed like ready', async () => {
        const signedBytes = [new Uint8Array([9])]
        assembleMock.mockReturnValue({
            kind: 'success',
            signedTransactionsBytes: signedBytes,
        })

        expect(
            await classifyHandoffPoll(
                makeDetail({ status: 'confirmed' }),
                makeHandoff(),
            ),
        ).toEqual({ kind: 'ready', assembledBytes: signedBytes })
    })

    it('soft-rejects on declined status', async () => {
        expect(
            await classifyHandoffPoll(
                makeDetail({ status: 'declined' }),
                makeHandoff(),
            ),
        ).toEqual({ kind: 'soft-reject', reason: 'declined' })
    })

    it('soft-rejects on expired status', async () => {
        expect(
            await classifyHandoffPoll(
                makeDetail({ status: 'expired' }),
                makeHandoff(),
            ),
        ).toEqual({ kind: 'soft-reject', reason: 'expired' })
    })

    it('errors on failed status, carrying the backend fail reason', async () => {
        expect(
            await classifyHandoffPoll(
                makeDetail({
                    status: 'failed',
                    fail_reason_display: 'insufficient funds',
                }),
                makeHandoff(),
            ),
        ).toEqual({
            kind: 'error',
            reason: {
                kind: 'backend-failed',
                displayReason: 'insufficient funds',
            },
        })
    })

    it('errors on failed status with a null fail reason', async () => {
        expect(
            await classifyHandoffPoll(
                makeDetail({ status: 'failed', fail_reason_display: null }),
                makeHandoff(),
            ),
        ).toEqual({
            kind: 'error',
            reason: { kind: 'backend-failed', displayReason: null },
        })
    })
})

describe('errorReasonToMessage', () => {
    it('maps no-transactions to the generic message', () => {
        expect(
            errorReasonToMessage({ kind: 'no-transactions' }, messages),
        ).toBe('msg.no_transactions')
    })

    it('maps assembly-failed to the interpolated message', () => {
        expect(
            errorReasonToMessage(
                { kind: 'assembly-failed', detail: 'bad subsig' },
                messages,
            ),
        ).toBe('msg.assembly_failed:bad subsig')
    })

    it('prefers the backend display reason when present', () => {
        expect(
            errorReasonToMessage(
                { kind: 'backend-failed', displayReason: 'nope' },
                messages,
            ),
        ).toBe('nope')
    })

    it('falls back to the generic failed message when the display reason is null', () => {
        expect(
            errorReasonToMessage(
                { kind: 'backend-failed', displayReason: null },
                messages,
            ),
        ).toBe('msg.failed')
    })
})

describe('resolveHandoffOutcome', () => {
    beforeEach(() => {
        walletConnectHandoffs.__resetForTests()
        loggerWarnMock.mockReset()
    })

    it('delivers assembled bytes, marks confirmed, and unregisters on ready', async () => {
        const handoff = makeHandoff()
        walletConnectHandoffs.register(handoff)
        const markConfirmed = vi.fn().mockResolvedValue(undefined)
        const assembledBytes = [new Uint8Array([1, 2, 3])]

        await resolveHandoffOutcome({
            outcome: { kind: 'ready', assembledBytes },
            handoff,
            messages,
            markConfirmed,
        })

        expect(handoff.callbacks.approveSignedBytes).toHaveBeenCalledWith(
            assembledBytes,
        )
        expect(markConfirmed).toHaveBeenCalledWith({
            network: 'testnet',
            deviceId: 'device-1',
            signRequestIds: [SIGN_REQUEST_ID],
        })
        expect(handoff.callbacks.error).not.toHaveBeenCalled()
        expect(walletConnectHandoffs.get(SIGN_REQUEST_ID)).toBeUndefined()
    })

    it('still resolves when mark-confirmed fails (non-fatal, logged)', async () => {
        const handoff = makeHandoff()
        walletConnectHandoffs.register(handoff)
        const markConfirmed = vi.fn().mockRejectedValue(new Error('500'))

        await resolveHandoffOutcome({
            outcome: { kind: 'ready', assembledBytes: [new Uint8Array([1])] },
            handoff,
            messages,
            markConfirmed,
        })

        expect(handoff.callbacks.approveSignedBytes).toHaveBeenCalled()
        expect(handoff.callbacks.error).not.toHaveBeenCalled()
        expect(loggerWarnMock).toHaveBeenCalled()
        expect(walletConnectHandoffs.get(SIGN_REQUEST_ID)).toBeUndefined()
    })

    it('errors when delivering the signed bytes to the dApp fails', async () => {
        const handoff = makeHandoff()
        handoff.callbacks.approveSignedBytes = vi
            .fn()
            .mockRejectedValue(new Error('session dropped'))
        walletConnectHandoffs.register(handoff)
        const markConfirmed = vi.fn().mockResolvedValue(undefined)

        await resolveHandoffOutcome({
            outcome: { kind: 'ready', assembledBytes: [new Uint8Array([1])] },
            handoff,
            messages,
            markConfirmed,
        })

        // The dApp gets the generic localized message, not the raw WC error.
        expect(handoff.callbacks.error).toHaveBeenCalledWith(
            new Error('msg.delivery_failed'),
        )
        // The raw error is kept for diagnostics.
        expect(loggerWarnMock).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ cause: 'session dropped' }),
        )
        expect(markConfirmed).not.toHaveBeenCalled()
        expect(walletConnectHandoffs.get(SIGN_REQUEST_ID)).toBeUndefined()
    })

    it('soft-rejects without an error callback on a declined outcome', async () => {
        const handoff = makeHandoff()
        walletConnectHandoffs.register(handoff)

        await resolveHandoffOutcome({
            outcome: { kind: 'soft-reject', reason: 'declined' },
            handoff,
            messages,
            markConfirmed: vi.fn(),
        })

        expect(handoff.callbacks.reject).toHaveBeenCalledWith({
            kind: 'softReject',
            error: new Error('msg.declined'),
        })
        expect(handoff.callbacks.error).not.toHaveBeenCalled()
        expect(walletConnectHandoffs.get(SIGN_REQUEST_ID)).toBeUndefined()
    })

    it('soft-rejects with the expired message on an expired outcome', async () => {
        const handoff = makeHandoff()
        walletConnectHandoffs.register(handoff)

        await resolveHandoffOutcome({
            outcome: { kind: 'soft-reject', reason: 'expired' },
            handoff,
            messages,
            markConfirmed: vi.fn(),
        })

        expect(handoff.callbacks.reject).toHaveBeenCalledWith({
            kind: 'softReject',
            error: new Error('msg.expired'),
        })
    })

    it('delivers an error outcome via the error callback and logs it', async () => {
        const handoff = makeHandoff()
        walletConnectHandoffs.register(handoff)

        await resolveHandoffOutcome({
            outcome: {
                kind: 'error',
                reason: { kind: 'assembly-failed', detail: 'bad subsig' },
            },
            handoff,
            messages,
            markConfirmed: vi.fn(),
        })

        expect(handoff.callbacks.error).toHaveBeenCalledWith(
            new Error('msg.assembly_failed:bad subsig'),
        )
        expect(loggerWarnMock).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                message: 'msg.assembly_failed:bad subsig',
            }),
        )
        expect(walletConnectHandoffs.get(SIGN_REQUEST_ID)).toBeUndefined()
    })
})
