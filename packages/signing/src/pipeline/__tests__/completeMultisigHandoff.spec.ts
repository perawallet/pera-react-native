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

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        logger: {
            debug: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
        },
    }
})

import {
    completeMultisigHandoff,
    type MultisigHandoffCompletionDeps,
} from '../completeMultisigHandoff'
import { SubmissionError } from '../errors'

const ASSEMBLED = new Uint8Array([1, 2, 3])

const makeDeps = (): {
    [K in keyof MultisigHandoffCompletionDeps]: ReturnType<typeof vi.fn>
} => ({
    submit: vi.fn().mockResolvedValue(['txid-1']),
    recordSubmitted: vi.fn(),
    markConfirmed: vi.fn().mockResolvedValue(undefined),
    decline: vi.fn().mockResolvedValue(undefined),
    removeHandoff: vi.fn(),
    reportError: vi.fn(),
    onSubmitted: vi.fn().mockResolvedValue(undefined),
    onSoftRejected: vi.fn().mockResolvedValue(undefined),
    onFailed: vi.fn().mockResolvedValue(undefined),
})

describe('completeMultisigHandoff', () => {
    let deps: ReturnType<typeof makeDeps>

    beforeEach(() => {
        deps = makeDeps()
    })

    const run = (
        outcome: Parameters<typeof completeMultisigHandoff>[0]['outcome'],
        alreadySubmittedTxIds?: string[],
    ) =>
        completeMultisigHandoff({
            outcome,
            deps: deps as unknown as MultisigHandoffCompletionDeps,
            alreadySubmittedTxIds,
        })

    test('ready: submits, records the tx ids, marks confirmed, then cleans up', async () => {
        await run({ kind: 'ready', assembledBytes: [ASSEMBLED] })

        expect(deps.submit).toHaveBeenCalledWith([ASSEMBLED])
        expect(deps.onSubmitted).toHaveBeenCalledWith(['txid-1'])
        expect(deps.markConfirmed).toHaveBeenCalledTimes(1)
        expect(deps.removeHandoff).toHaveBeenCalledTimes(1)
        // The happy path neither reports an error nor declines.
        expect(deps.reportError).not.toHaveBeenCalled()
        expect(deps.decline).not.toHaveBeenCalled()
        expect(deps.onFailed).not.toHaveBeenCalled()
    })

    test('ready: a submit failure reports, declines, marks failed, cleans up once', async () => {
        const error = new Error('algod 400')
        deps.submit.mockRejectedValueOnce(error)

        await run({ kind: 'ready', assembledBytes: [ASSEMBLED] })

        expect(deps.reportError).toHaveBeenCalledWith(error)
        expect(deps.decline).toHaveBeenCalledTimes(1)
        expect(deps.onFailed).toHaveBeenCalledTimes(1)
        expect(deps.onSubmitted).not.toHaveBeenCalled()
        // Nothing was submitted, so nothing must be durably marked as such.
        expect(deps.recordSubmitted).not.toHaveBeenCalled()
        expect(deps.removeHandoff).toHaveBeenCalledTimes(1)
    })

    test('ready: durably records the submission before any other post-submit effect', async () => {
        await run({ kind: 'ready', assembledBytes: [ASSEMBLED] })

        expect(deps.recordSubmitted).toHaveBeenCalledWith(['txid-1'])
        // Marker first: a crash during the (network) status calls must find it.
        expect(deps.recordSubmitted.mock.invocationCallOrder[0]).toBeLessThan(
            deps.onSubmitted.mock.invocationCallOrder[0],
        )
        expect(deps.recordSubmitted.mock.invocationCallOrder[0]).toBeLessThan(
            deps.markConfirmed.mock.invocationCallOrder[0],
        )
    })

    test('ready: a throwing recordSubmitted is best-effort — never routes to the failure path', async () => {
        deps.recordSubmitted.mockImplementationOnce(() => {
            throw new Error('storage full')
        })

        await run({ kind: 'ready', assembledBytes: [ASSEMBLED] })

        expect(deps.onSubmitted).toHaveBeenCalledWith(['txid-1'])
        expect(deps.markConfirmed).toHaveBeenCalledTimes(1)
        expect(deps.removeHandoff).toHaveBeenCalledTimes(1)
        expect(deps.reportError).not.toHaveBeenCalled()
        expect(deps.onFailed).not.toHaveBeenCalled()
    })

    test('already submitted: replays the post-submit tail, never submits again', async () => {
        await run({ kind: 'ready', assembledBytes: [ASSEMBLED] }, [
            'txid-persisted',
        ])

        expect(deps.submit).not.toHaveBeenCalled()
        expect(deps.recordSubmitted).not.toHaveBeenCalled()
        expect(deps.onSubmitted).toHaveBeenCalledWith(['txid-persisted'])
        expect(deps.markConfirmed).toHaveBeenCalledTimes(1)
        expect(deps.removeHandoff).toHaveBeenCalledTimes(1)
        expect(deps.reportError).not.toHaveBeenCalled()
        expect(deps.onFailed).not.toHaveBeenCalled()
    })

    test('already submitted: overrides a post-crash soft-reject — the swap is on chain', async () => {
        // The backend may have expired the request after the crash (it never
        // got mark-confirmed); that must not fail a landed swap.
        await run({ kind: 'soft-reject', reason: 'expired' }, [
            'txid-persisted',
        ])

        expect(deps.onSoftRejected).not.toHaveBeenCalled()
        expect(deps.onSubmitted).toHaveBeenCalledWith(['txid-persisted'])
        expect(deps.markConfirmed).toHaveBeenCalledTimes(1)
        expect(deps.removeHandoff).toHaveBeenCalledTimes(1)
    })

    test('already submitted: overrides a post-crash backend failure — never declines', async () => {
        await run(
            {
                kind: 'error',
                reason: { kind: 'backend-failed', displayReason: null },
            },
            ['txid-persisted'],
        )

        expect(deps.onFailed).not.toHaveBeenCalled()
        expect(deps.decline).not.toHaveBeenCalled()
        expect(deps.reportError).not.toHaveBeenCalled()
        expect(deps.onSubmitted).toHaveBeenCalledWith(['txid-persisted'])
        expect(deps.removeHandoff).toHaveBeenCalledTimes(1)
    })

    test('ready: a failing onSubmitted is best-effort — markConfirmed and cleanup still run', async () => {
        deps.onSubmitted.mockRejectedValueOnce(new Error('status 500'))

        await run({ kind: 'ready', assembledBytes: [ASSEMBLED] })

        expect(deps.markConfirmed).toHaveBeenCalledTimes(1)
        expect(deps.removeHandoff).toHaveBeenCalledTimes(1)
        // A best-effort status failure is not a submission failure.
        expect(deps.reportError).not.toHaveBeenCalled()
        expect(deps.onFailed).not.toHaveBeenCalled()
    })

    test('ready: a failing markConfirmed is swallowed (txns are already on chain)', async () => {
        deps.markConfirmed.mockRejectedValueOnce(new Error('network'))

        await run({ kind: 'ready', assembledBytes: [ASSEMBLED] })

        expect(deps.onSubmitted).toHaveBeenCalledTimes(1)
        expect(deps.removeHandoff).toHaveBeenCalledTimes(1)
        expect(deps.reportError).not.toHaveBeenCalled()
    })

    test('soft-reject (declined): records the rejection and cleans up, nothing else', async () => {
        await run({ kind: 'soft-reject', reason: 'declined' })

        expect(deps.onSoftRejected).toHaveBeenCalledWith('declined')
        expect(deps.removeHandoff).toHaveBeenCalledTimes(1)
        expect(deps.submit).not.toHaveBeenCalled()
        expect(deps.reportError).not.toHaveBeenCalled()
        expect(deps.decline).not.toHaveBeenCalled()
    })

    test('soft-reject: a failing onSoftRejected is best-effort — cleanup still runs', async () => {
        deps.onSoftRejected.mockRejectedValueOnce(new Error('status 500'))

        await run({ kind: 'soft-reject', reason: 'expired' })

        expect(deps.removeHandoff).toHaveBeenCalledTimes(1)
    })

    test('error: reports, declines, marks failed, cleans up — never submits', async () => {
        await run({
            kind: 'error',
            reason: { kind: 'backend-failed', displayReason: null },
        })

        expect(deps.submit).not.toHaveBeenCalled()
        expect(deps.reportError).toHaveBeenCalledTimes(1)
        expect(deps.decline).toHaveBeenCalledTimes(1)
        expect(deps.onFailed).toHaveBeenCalledTimes(1)
        expect(deps.removeHandoff).toHaveBeenCalledTimes(1)
    })

    test('error: surfaces the backend display reason to the user', async () => {
        await run({
            kind: 'error',
            reason: {
                kind: 'backend-failed',
                displayReason: 'insufficient balance',
            },
        })

        const reported = deps.reportError.mock.calls[0][0]
        expect(reported).toBeInstanceOf(Error)
        expect((reported as Error).message).toBe('insufficient balance')
    })

    test('failure: a failing decline is swallowed — the swap is still marked failed', async () => {
        deps.submit.mockRejectedValueOnce(new Error('algod 400'))
        deps.decline.mockRejectedValueOnce(new Error('backend 409'))

        await run({ kind: 'ready', assembledBytes: [ASSEMBLED] })

        expect(deps.onFailed).toHaveBeenCalledTimes(1)
        expect(deps.removeHandoff).toHaveBeenCalledTimes(1)
    })

    test('unknown submit outcome: reports and fails, but leaves the live request alone', async () => {
        // The group may be confirming — declining would cancel a request for a
        // transaction that lands moments later.
        deps.submit.mockRejectedValue(
            new SubmissionError(
                ['TXID'],
                'unknown-outcome',
                new AlgodError('network_unavailable', {}),
            ),
        )

        await run({ kind: 'ready', assembledBytes: [ASSEMBLED] })

        expect(deps.decline).not.toHaveBeenCalled()
        expect(deps.reportError).toHaveBeenCalled()
        // Deliberate: the backend still gets a terminal status. Correcting it later
        // is reconciliation, which is PERA-4588's scope.
        expect(deps.onFailed).toHaveBeenCalled()
    })

    test('definitive node rejection: still declines', async () => {
        deps.submit.mockRejectedValue(
            new SubmissionError(
                ['TXID'],
                'rejected-by-node',
                new AlgodError('overspend', {}),
            ),
        )

        await run({ kind: 'ready', assembledBytes: [ASSEMBLED] })

        expect(deps.decline).toHaveBeenCalled()
    })

    test('failure before the POST: still declines', async () => {
        // A pre-POST throw (e.g. a missing assembled slot) is not a submission
        // outcome at all — nothing is in flight, so cancelling is correct.
        deps.submit.mockRejectedValue(new Error('missing slot'))

        await run({ kind: 'ready', assembledBytes: [ASSEMBLED] })

        expect(deps.decline).toHaveBeenCalled()
    })
})
