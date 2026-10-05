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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { AlgodError } from '@perawallet/wallet-core-blockchain'

vi.mock('@perawallet/wallet-core-signing', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-signing')>()
    return {
        ...actual,
        completeMultisigHandoff: vi.fn(),
        deriveSubmissionAttemptFromBytes: vi.fn(),
    }
})

import {
    completeMultisigHandoff,
    deriveSubmissionAttemptFromBytes,
    SubmissionError,
    type MultisigHandoffCompletionDeps,
} from '@perawallet/wallet-core-signing'
import type { SwapHandoffRecord } from '../../models'
import {
    resolveSwapHandoffOutcome,
    type SwapHandoffResolutionDeps,
} from '../resolveSwapHandoffOutcome'

const PRESIGNED_BYTES = new Uint8Array([1, 1, 1])
const ASSEMBLED_BYTES = new Uint8Array([2, 2, 2])

const makeRecord = (
    overrides: Partial<SwapHandoffRecord> = {},
): SwapHandoffRecord => ({
    swapIdStr: '42',
    signRequestId: 'req-1',
    scope: { chainId: 'algorand', networkId: 'mainnet' },
    multisigAddress: 'JOINT_ADDR',
    deviceId: 'device-1',
    msigMetadata: { version: 1, threshold: 2, addresses: ['A', 'B'] },
    // One group: a pre-signed slot followed by a to-sign slot.
    plan: [
        {
            slots: [
                { kind: 'preSigned', signedTxnBase64: 'cHJlc2lnbmVk' },
                { kind: 'toSign', flatIndex: 0 },
            ],
        },
    ],
    expectedRawTransactionsBase64: ['cmF3'],
    registeredAt: 1,
    ...overrides,
})

const makeDeps = (): {
    [K in keyof SwapHandoffResolutionDeps]: ReturnType<typeof vi.fn>
} => ({
    submitGroup: vi.fn().mockResolvedValue(['txid-1']),
    markSubmitted: vi.fn(),
    decodeBase64: vi.fn().mockReturnValue(PRESIGNED_BYTES),
    updateSwapStatus: vi.fn().mockResolvedValue(undefined),
    markConfirmed: vi.fn().mockResolvedValue(undefined),
    removeHandoff: vi.fn(),
    reportError: vi.fn(),
    declineSignRequest: vi.fn().mockResolvedValue(undefined),
    recordSubmissionAttempt: vi.fn().mockResolvedValue('attempt-1'),
    markSubmissionUnknown: vi.fn().mockResolvedValue(undefined),
    markSubmissionFailed: vi.fn().mockResolvedValue(undefined),
})

// The completion orchestration (submit -> record -> mark-confirmed, decline on
// failure, cleanup) is chain-owned and covered where it lives; this suite drives
// the collaborators the swap hands it.
describe('resolveSwapHandoffOutcome', () => {
    let deps: ReturnType<typeof makeDeps>

    const resolve = async (
        record: SwapHandoffRecord = makeRecord(),
        outcome: Parameters<typeof resolveSwapHandoffOutcome>[0]['outcome'] = {
            kind: 'ready',
            assembledBytes: [ASSEMBLED_BYTES],
        },
    ): Promise<MultisigHandoffCompletionDeps> => {
        await resolveSwapHandoffOutcome({
            outcome,
            record,
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })
        return vi.mocked(completeMultisigHandoff).mock.calls[0][0].deps
    }

    beforeEach(() => {
        deps = makeDeps()
        vi.mocked(completeMultisigHandoff).mockReset().mockResolvedValue()
        vi.mocked(deriveSubmissionAttemptFromBytes)
            .mockReset()
            .mockReturnValue({
                txIds: ['derived-1'],
                lastValid: 200,
            })
    })

    test('hands the shared orchestrator the outcome and the txIds persisted by a previous session', async () => {
        const outcome = { kind: 'soft-reject', reason: 'expired' } as const
        const record = makeRecord({
            submission: { txIds: ['txid-persisted'], submittedAt: 2 },
        })

        await resolve(record, outcome)

        expect(completeMultisigHandoff).toHaveBeenCalledWith(
            expect.objectContaining({
                outcome,
                alreadySubmittedTxIds: ['txid-persisted'],
            }),
        )
    })

    test('does not claim a prior submission for a fresh record', async () => {
        await resolve()

        expect(
            vi.mocked(completeMultisigHandoff).mock.calls[0][0]
                .alreadySubmittedTxIds,
        ).toBeUndefined()
    })

    test('submit: interleaves pre-signed + assembled bytes and submits the group', async () => {
        const completionDeps = await resolve()

        await expect(completionDeps.submit([ASSEMBLED_BYTES])).resolves.toEqual(
            ['txid-1'],
        )

        expect(deps.decodeBase64).toHaveBeenCalledWith('cHJlc2lnbmVk')
        expect(deps.submitGroup).toHaveBeenCalledWith([
            PRESIGNED_BYTES,
            ASSEMBLED_BYTES,
        ])
    })

    test('submit: submits each group separately for a multi-group swap', async () => {
        const record = makeRecord({
            plan: [
                { slots: [{ kind: 'toSign', flatIndex: 0 }] },
                { slots: [{ kind: 'toSign', flatIndex: 1 }] },
            ],
        })
        const a = new Uint8Array([10])
        const b = new Uint8Array([20])
        const completionDeps = await resolve(record)

        await completionDeps.submit([a, b])

        expect(deps.submitGroup).toHaveBeenCalledTimes(2)
        expect(deps.submitGroup).toHaveBeenNthCalledWith(1, [a])
        expect(deps.submitGroup).toHaveBeenNthCalledWith(2, [b])
    })

    test('submit: writes a ledger row per group before each submitGroup POST', async () => {
        const a = new Uint8Array([10])
        const b = new Uint8Array([20])
        const record = makeRecord({
            plan: [
                { slots: [{ kind: 'toSign', flatIndex: 0 }] },
                { slots: [{ kind: 'toSign', flatIndex: 1 }] },
            ],
        })
        vi.mocked(deriveSubmissionAttemptFromBytes)
            .mockReset()
            .mockImplementation((_chainId, bytes: readonly Uint8Array[]) =>
                bytes[0] === a
                    ? { txIds: ['id-a'], lastValid: 20 }
                    : { txIds: ['id-b'], lastValid: 40 },
            )
        const completionDeps = await resolve(record)

        await completionDeps.submit([a, b])

        expect(deps.recordSubmissionAttempt).toHaveBeenCalledTimes(2)
        expect(deps.recordSubmissionAttempt).toHaveBeenNthCalledWith(1, {
            scope: { chainId: 'algorand', networkId: 'mainnet' },
            txIds: ['id-a'],
            flow: 'cosign',
            intentKey: { kind: 'cosign', signRequestId: 'req-1', swapId: '42' },
            // Without a sender no sender-scoped guard can match a cosign row,
            // which let a re-proposed shared-account swap past the guard.
            sender: 'JOINT_ADDR',
            lastValid: 20,
        })
        expect(deps.recordSubmissionAttempt).toHaveBeenNthCalledWith(2, {
            scope: { chainId: 'algorand', networkId: 'mainnet' },
            txIds: ['id-b'],
            flow: 'cosign',
            intentKey: { kind: 'cosign', signRequestId: 'req-1', swapId: '42' },
            sender: 'JOINT_ADDR',
            lastValid: 40,
        })
        // The durable row must exist before the POST, not after.
        expect(
            deps.recordSubmissionAttempt.mock.invocationCallOrder[0],
        ).toBeLessThan(deps.submitGroup.mock.invocationCallOrder[0])
        expect(
            deps.recordSubmissionAttempt.mock.invocationCallOrder[1],
        ).toBeLessThan(deps.submitGroup.mock.invocationCallOrder[1])
    })

    test('submit: skips the ledger row when the group derives no tx ids', async () => {
        vi.mocked(deriveSubmissionAttemptFromBytes).mockReturnValueOnce({
            txIds: [],
        })
        const completionDeps = await resolve()

        await completionDeps.submit([ASSEMBLED_BYTES])

        expect(deps.recordSubmissionAttempt).not.toHaveBeenCalled()
        expect(deps.submitGroup).toHaveBeenCalledTimes(1)
    })

    test('submit: a missing assembled signature rejects without submitting a partial group', async () => {
        const completionDeps = await resolve()

        await expect(completionDeps.submit([])).rejects.toThrow()

        expect(deps.submitGroup).not.toHaveBeenCalled()
    })

    test('submit: an unknown outcome marks the attempt unknown and rethrows for the orchestrator to retain the handoff', async () => {
        deps.submitGroup.mockRejectedValueOnce(
            new SubmissionError(
                ['TXID'],
                'unknown-outcome',
                new AlgodError('network_unavailable', {}),
            ),
        )
        const completionDeps = await resolve()

        await expect(
            completionDeps.submit([ASSEMBLED_BYTES]),
        ).rejects.toMatchObject({
            classification: 'unknown-outcome',
            txIds: ['TXID'],
        })

        expect(deps.markSubmissionUnknown).toHaveBeenCalledWith('attempt-1')
        expect(deps.markSubmissionFailed).not.toHaveBeenCalled()
    })

    test('submit: an unknown outcome on a later group carries the earlier groups txIds too', async () => {
        const record = makeRecord({
            plan: [
                { slots: [{ kind: 'toSign', flatIndex: 0 }] },
                { slots: [{ kind: 'toSign', flatIndex: 1 }] },
            ],
        })
        deps.submitGroup
            .mockResolvedValueOnce(['first-group'])
            .mockRejectedValueOnce(
                new SubmissionError(
                    ['second-group'],
                    'unknown-outcome',
                    new AlgodError('network_unavailable', {}),
                ),
            )
        const completionDeps = await resolve(record)

        await expect(
            completionDeps.submit([new Uint8Array([1]), new Uint8Array([2])]),
        ).rejects.toMatchObject({
            classification: 'unknown-outcome',
            txIds: ['first-group', 'second-group'],
        })
    })

    test('submit: a rejection by the node marks the attempt failed and rethrows', async () => {
        const rejected = new SubmissionError(
            ['TXID'],
            'rejected-by-node',
            new AlgodError('overspend', {}),
        )
        deps.submitGroup.mockRejectedValueOnce(rejected)
        const completionDeps = await resolve()

        await expect(completionDeps.submit([ASSEMBLED_BYTES])).rejects.toBe(
            rejected,
        )

        expect(deps.markSubmissionFailed).toHaveBeenCalledWith('attempt-1')
        expect(deps.markSubmissionUnknown).not.toHaveBeenCalled()
    })

    test('forwards the durable marker, cleanup and error reporting to the swap collaborators', async () => {
        const completionDeps = await resolve()
        const error = new Error('boom')

        completionDeps.recordSubmitted?.(['txid-1'])
        completionDeps.removeHandoff()
        completionDeps.reportError(error)
        await completionDeps.decline()
        await completionDeps.markConfirmed()

        expect(deps.markSubmitted).toHaveBeenCalledWith(['txid-1'])
        expect(deps.removeHandoff).toHaveBeenCalledWith('req-1')
        expect(deps.reportError).toHaveBeenCalledWith(error)
        expect(deps.declineSignRequest).toHaveBeenCalledWith('req-1')
        expect(deps.markConfirmed).toHaveBeenCalledWith({
            network: 'mainnet',
            deviceId: 'device-1',
            signRequestIds: ['req-1'],
        })
    })

    test('onSubmitted marks the swap in_progress with the collected txIds', async () => {
        const completionDeps = await resolve()

        await completionDeps.onSubmitted(['txid-1'])

        expect(deps.updateSwapStatus).toHaveBeenCalledWith({
            swapId: '42',
            data: {
                status: 'in_progress',
                submitted_transaction_ids: ['txid-1'],
                swap_version: 'v2',
            },
        })
    })

    test('onSoftRejected maps a decline to cancelled and an expiry to failed', async () => {
        const completionDeps = await resolve()

        await completionDeps.onSoftRejected('declined')
        await completionDeps.onSoftRejected('expired')

        expect(deps.updateSwapStatus).toHaveBeenNthCalledWith(1, {
            swapId: '42',
            data: {
                status: 'cancelled',
                reason: 'user_cancelled',
                swap_version: 'v2',
            },
        })
        expect(deps.updateSwapStatus).toHaveBeenNthCalledWith(2, {
            swapId: '42',
            data: { status: 'failed', reason: 'other', swap_version: 'v2' },
        })
    })

    test('onFailed marks the swap failed with a blockchain error', async () => {
        const completionDeps = await resolve()

        await completionDeps.onFailed()

        expect(deps.updateSwapStatus).toHaveBeenCalledWith({
            swapId: '42',
            data: {
                status: 'failed',
                reason: 'blockchain_error',
                swap_version: 'v2',
            },
        })
    })
})
