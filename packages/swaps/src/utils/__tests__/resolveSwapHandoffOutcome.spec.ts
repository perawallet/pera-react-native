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
        deriveSubmissionAttemptFromBytes: vi.fn(),
    }
})

import {
    deriveSubmissionAttemptFromBytes,
    SubmissionError,
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
    network: 'mainnet',
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

describe('resolveSwapHandoffOutcome', () => {
    let deps: ReturnType<typeof makeDeps>

    beforeEach(() => {
        deps = makeDeps()
        vi.mocked(deriveSubmissionAttemptFromBytes)
            .mockReset()
            .mockReturnValue({
                txIds: ['derived-1'],
                lastValid: 200,
            })
    })

    test('ready: interleaves pre-signed + assembled bytes and submits the group', async () => {
        await resolveSwapHandoffOutcome({
            outcome: { kind: 'ready', assembledBytes: [ASSEMBLED_BYTES] },
            record: makeRecord(),
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })

        expect(deps.decodeBase64).toHaveBeenCalledWith('cHJlc2lnbmVk')
        expect(deps.submitGroup).toHaveBeenCalledWith([
            PRESIGNED_BYTES,
            ASSEMBLED_BYTES,
        ])
    })

    test('ready: persists the submitted marker with the collected txIds', async () => {
        await resolveSwapHandoffOutcome({
            outcome: { kind: 'ready', assembledBytes: [ASSEMBLED_BYTES] },
            record: makeRecord(),
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })

        expect(deps.markSubmitted).toHaveBeenCalledWith(['txid-1'])
        // Durable marker before the (network) status update — a crash in
        // between must not re-submit on relaunch.
        expect(deps.markSubmitted.mock.invocationCallOrder[0]).toBeLessThan(
            deps.updateSwapStatus.mock.invocationCallOrder[0],
        )
    })

    test('ready: a submission failure never persists the submitted marker', async () => {
        deps.submitGroup.mockRejectedValueOnce(new Error('algod 400'))

        await resolveSwapHandoffOutcome({
            outcome: { kind: 'ready', assembledBytes: [ASSEMBLED_BYTES] },
            record: makeRecord(),
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })

        expect(deps.markSubmitted).not.toHaveBeenCalled()
    })

    test('already submitted (crash recovery): replays in_progress with the persisted txIds, never re-submits', async () => {
        const record = makeRecord({
            submission: { txIds: ['txid-persisted'], submittedAt: 2 },
        })

        await resolveSwapHandoffOutcome({
            outcome: { kind: 'ready', assembledBytes: [ASSEMBLED_BYTES] },
            record,
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })

        expect(deps.submitGroup).not.toHaveBeenCalled()
        expect(deps.updateSwapStatus).toHaveBeenCalledWith({
            swapId: '42',
            data: {
                status: 'in_progress',
                submitted_transaction_ids: ['txid-persisted'],
                swap_version: 'v2',
            },
        })
        expect(deps.markConfirmed).toHaveBeenCalledTimes(1)
        expect(deps.removeHandoff).toHaveBeenCalledWith('req-1')
    })

    test('already submitted: a post-crash expired poll must not flip the landed swap to failed', async () => {
        const record = makeRecord({
            submission: { txIds: ['txid-persisted'], submittedAt: 2 },
        })

        await resolveSwapHandoffOutcome({
            outcome: { kind: 'soft-reject', reason: 'expired' },
            record,
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })

        expect(deps.submitGroup).not.toHaveBeenCalled()
        expect(deps.updateSwapStatus).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ status: 'in_progress' }),
            }),
        )
        expect(deps.reportError).not.toHaveBeenCalled()
        expect(deps.declineSignRequest).not.toHaveBeenCalled()
        expect(deps.removeHandoff).toHaveBeenCalledWith('req-1')
    })

    test('ready: marks the swap in_progress with collected txIds', async () => {
        await resolveSwapHandoffOutcome({
            outcome: { kind: 'ready', assembledBytes: [ASSEMBLED_BYTES] },
            record: makeRecord(),
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })

        expect(deps.updateSwapStatus).toHaveBeenCalledWith({
            swapId: '42',
            data: {
                status: 'in_progress',
                submitted_transaction_ids: ['txid-1'],
                swap_version: 'v2',
            },
        })
        expect(deps.markConfirmed).toHaveBeenCalledWith({
            network: 'mainnet',
            deviceId: 'device-1',
            signRequestIds: ['req-1'],
        })
        expect(deps.removeHandoff).toHaveBeenCalledWith('req-1')
    })

    test('ready: submits each group separately for a multi-group swap', async () => {
        const record = makeRecord({
            plan: [
                { slots: [{ kind: 'toSign', flatIndex: 0 }] },
                { slots: [{ kind: 'toSign', flatIndex: 1 }] },
            ],
        })
        const a = new Uint8Array([10])
        const b = new Uint8Array([20])

        await resolveSwapHandoffOutcome({
            outcome: { kind: 'ready', assembledBytes: [a, b] },
            record,
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })

        expect(deps.submitGroup).toHaveBeenCalledTimes(2)
        expect(deps.submitGroup).toHaveBeenNthCalledWith(1, [a])
        expect(deps.submitGroup).toHaveBeenNthCalledWith(2, [b])
    })

    test('ready: writes a ledger row per group before each submitGroup POST', async () => {
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
            .mockImplementation((bytes: readonly Uint8Array[]) =>
                bytes[0] === a
                    ? { txIds: ['id-a'], lastValid: 20 }
                    : { txIds: ['id-b'], lastValid: 40 },
            )

        await resolveSwapHandoffOutcome({
            outcome: { kind: 'ready', assembledBytes: [a, b] },
            record,
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })

        expect(deps.recordSubmissionAttempt).toHaveBeenCalledTimes(2)
        expect(deps.recordSubmissionAttempt).toHaveBeenNthCalledWith(1, {
            network: 'mainnet',
            txIds: ['id-a'],
            flow: 'cosign',
            intentKey: { kind: 'cosign', signRequestId: 'req-1', swapId: '42' },
            lastValid: 20,
        })
        expect(deps.recordSubmissionAttempt).toHaveBeenNthCalledWith(2, {
            network: 'mainnet',
            txIds: ['id-b'],
            flow: 'cosign',
            intentKey: { kind: 'cosign', signRequestId: 'req-1', swapId: '42' },
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

    test('ready: skips the ledger row when the group derives no tx ids', async () => {
        vi.mocked(deriveSubmissionAttemptFromBytes).mockReturnValueOnce({
            txIds: [],
        })

        await resolveSwapHandoffOutcome({
            outcome: { kind: 'ready', assembledBytes: [ASSEMBLED_BYTES] },
            record: makeRecord(),
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })

        expect(deps.recordSubmissionAttempt).not.toHaveBeenCalled()
        expect(deps.submitGroup).toHaveBeenCalledTimes(1)
    })

    test('unknown-outcome: marks the attempt unknown and lets the shared orchestrator retain the handoff', async () => {
        deps.submitGroup.mockRejectedValueOnce(
            new SubmissionError(
                ['TXID'],
                'unknown-outcome',
                new AlgodError('network_unavailable', {}),
            ),
        )

        await resolveSwapHandoffOutcome({
            outcome: { kind: 'ready', assembledBytes: [ASSEMBLED_BYTES] },
            record: makeRecord(),
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })

        expect(deps.markSubmissionUnknown).toHaveBeenCalledWith('attempt-1')
        expect(deps.markSubmissionFailed).not.toHaveBeenCalled()
        // The rethrown error reaches completeMultisigHandoff, which retains the
        // handoff instead of failing or removing it.
        expect(deps.updateSwapStatus).not.toHaveBeenCalled()
        expect(deps.declineSignRequest).not.toHaveBeenCalled()
        expect(deps.removeHandoff).not.toHaveBeenCalled()
    })

    test('rejected-by-node: marks the attempt failed and the failure propagates', async () => {
        deps.submitGroup.mockRejectedValueOnce(
            new SubmissionError(
                ['TXID'],
                'rejected-by-node',
                new AlgodError('overspend', {}),
            ),
        )

        await resolveSwapHandoffOutcome({
            outcome: { kind: 'ready', assembledBytes: [ASSEMBLED_BYTES] },
            record: makeRecord(),
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })

        expect(deps.markSubmissionFailed).toHaveBeenCalledWith('attempt-1')
        expect(deps.markSubmissionUnknown).not.toHaveBeenCalled()
        // The rethrown error drives completeMultisigHandoff's failure path.
        expect(deps.updateSwapStatus).toHaveBeenCalledWith({
            swapId: '42',
            data: {
                status: 'failed',
                reason: 'blockchain_error',
                swap_version: 'v2',
            },
        })
        expect(deps.removeHandoff).toHaveBeenCalledWith('req-1')
    })

    test('ready: a missing assembled signature fails the swap, never submits a partial group', async () => {
        await resolveSwapHandoffOutcome({
            outcome: { kind: 'ready', assembledBytes: [] },
            record: makeRecord(),
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })

        expect(deps.submitGroup).not.toHaveBeenCalled()
        expect(deps.updateSwapStatus).toHaveBeenCalledWith({
            swapId: '42',
            data: {
                status: 'failed',
                reason: 'blockchain_error',
                swap_version: 'v2',
            },
        })
        expect(deps.reportError).toHaveBeenCalled()
        expect(deps.declineSignRequest).toHaveBeenCalledWith('req-1')
        expect(deps.removeHandoff).toHaveBeenCalledWith('req-1')
    })

    test('ready: a submission failure flips the swap to failed and removes the handoff', async () => {
        deps.submitGroup.mockRejectedValueOnce(new Error('algod 400'))

        await resolveSwapHandoffOutcome({
            outcome: { kind: 'ready', assembledBytes: [ASSEMBLED_BYTES] },
            record: makeRecord(),
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })

        expect(deps.updateSwapStatus).toHaveBeenCalledWith({
            swapId: '42',
            data: {
                status: 'failed',
                reason: 'blockchain_error',
                swap_version: 'v2',
            },
        })
        expect(deps.removeHandoff).toHaveBeenCalledWith('req-1')
    })

    test('ready: a submission failure notifies the user and cancels the pending request', async () => {
        const submitError = new Error('balance below min')
        deps.submitGroup.mockRejectedValueOnce(submitError)

        await resolveSwapHandoffOutcome({
            outcome: { kind: 'ready', assembledBytes: [ASSEMBLED_BYTES] },
            record: makeRecord(),
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })

        // The proposer is told why (toast), and the still-live request is
        // cancelled so the pending sheet/inbox don't hang on "Submitting…".
        expect(deps.reportError).toHaveBeenCalledWith(submitError)
        expect(deps.declineSignRequest).toHaveBeenCalledWith('req-1')
    })

    test('ready: a cancel (decline) failure is swallowed — swap still fails cleanly', async () => {
        deps.submitGroup.mockRejectedValueOnce(new Error('algod 400'))
        deps.declineSignRequest.mockRejectedValueOnce(new Error('backend 409'))

        await resolveSwapHandoffOutcome({
            outcome: { kind: 'ready', assembledBytes: [ASSEMBLED_BYTES] },
            record: makeRecord(),
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })

        expect(deps.updateSwapStatus).toHaveBeenCalledWith({
            swapId: '42',
            data: {
                status: 'failed',
                reason: 'blockchain_error',
                swap_version: 'v2',
            },
        })
        expect(deps.removeHandoff).toHaveBeenCalledWith('req-1')
    })

    test('ready: a markConfirmed failure is swallowed (txns are already on chain)', async () => {
        deps.markConfirmed.mockRejectedValueOnce(new Error('network'))

        await resolveSwapHandoffOutcome({
            outcome: { kind: 'ready', assembledBytes: [ASSEMBLED_BYTES] },
            record: makeRecord(),
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })

        // Still reported in_progress and cleaned up.
        expect(deps.updateSwapStatus).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ status: 'in_progress' }),
            }),
        )
        expect(deps.removeHandoff).toHaveBeenCalledWith('req-1')
    })

    test('soft-reject (declined): cancels the swap as user_cancelled', async () => {
        await resolveSwapHandoffOutcome({
            outcome: { kind: 'soft-reject', reason: 'declined' },
            record: makeRecord(),
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })

        expect(deps.submitGroup).not.toHaveBeenCalled()
        expect(deps.updateSwapStatus).toHaveBeenCalledWith({
            swapId: '42',
            data: {
                status: 'cancelled',
                reason: 'user_cancelled',
                swap_version: 'v2',
            },
        })
        // A user decline is already terminal on the backend — don't toast or
        // re-cancel.
        expect(deps.reportError).not.toHaveBeenCalled()
        expect(deps.declineSignRequest).not.toHaveBeenCalled()
        expect(deps.removeHandoff).toHaveBeenCalledWith('req-1')
    })

    test('soft-reject (expired): fails the swap', async () => {
        await resolveSwapHandoffOutcome({
            outcome: { kind: 'soft-reject', reason: 'expired' },
            record: makeRecord(),
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })

        expect(deps.updateSwapStatus).toHaveBeenCalledWith({
            swapId: '42',
            data: { status: 'failed', reason: 'other', swap_version: 'v2' },
        })
        expect(deps.removeHandoff).toHaveBeenCalledWith('req-1')
    })

    test('a failing status update is swallowed — the handoff is still cleaned up', async () => {
        deps.updateSwapStatus.mockRejectedValueOnce(new Error('status 500'))

        await resolveSwapHandoffOutcome({
            outcome: { kind: 'soft-reject', reason: 'expired' },
            record: makeRecord(),
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })

        // Reporting status is best-effort; a rejection must not block teardown.
        expect(deps.removeHandoff).toHaveBeenCalledWith('req-1')
    })

    test('error: fails the swap and removes the handoff', async () => {
        await resolveSwapHandoffOutcome({
            outcome: {
                kind: 'error',
                reason: { kind: 'backend-failed', displayReason: null },
            },
            record: makeRecord(),
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })

        expect(deps.submitGroup).not.toHaveBeenCalled()
        expect(deps.updateSwapStatus).toHaveBeenCalledWith({
            swapId: '42',
            data: {
                status: 'failed',
                reason: 'blockchain_error',
                swap_version: 'v2',
            },
        })
        expect(deps.reportError).toHaveBeenCalled()
        expect(deps.declineSignRequest).toHaveBeenCalledWith('req-1')
        expect(deps.removeHandoff).toHaveBeenCalledWith('req-1')
    })

    test('leaves the sign request alone when the swap submit outcome is unknown', async () => {
        deps.submitGroup.mockRejectedValueOnce(
            new SubmissionError(
                ['TXID'],
                'unknown-outcome',
                new AlgodError('network_unavailable', {}),
            ),
        )

        await resolveSwapHandoffOutcome({
            outcome: { kind: 'ready', assembledBytes: [ASSEMBLED_BYTES] },
            record: makeRecord(),
            deps: deps as unknown as SwapHandoffResolutionDeps,
        })

        expect(deps.declineSignRequest).not.toHaveBeenCalled()
    })
})
