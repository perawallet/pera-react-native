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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Connection } from '@perawallet/wallet-extension-connections'
import type { ConnectionProposal } from '../models'
import {
    createProposalQueue,
    type ProposalQueueSheet,
    type ProposalQueueUi,
} from '../proposalQueue'

type MockProposal = ConnectionProposal & {
    approve: ReturnType<typeof vi.fn>
    reject: ReturnType<typeof vi.fn>
}

const makeConnection = (id: string): Connection =>
    ({ id, origin: { source: 'qr' } }) as unknown as Connection

const makeProposal = (
    proposalId: string,
    pairingId: string | undefined = proposalId,
): MockProposal =>
    ({
        kind: 'walletconnect-v1',
        proposalId,
        pairingId,
        peer: { name: 'dApp' },
        requested: { networks: [], methods: [] },
        expiresAt: Date.now() + 60_000,
        approve: vi.fn(async () => makeConnection(proposalId)),
        reject: vi.fn(async () => {}),
    }) as unknown as MockProposal

type Shown = {
    proposal?: ConnectionProposal
    connection?: Connection
    sheet: ProposalQueueSheet
    close: ReturnType<typeof vi.fn>
    resolveClosed: () => void
    rejectClosed: (error: Error) => void
}

const makeUi = () => {
    const approvals: Shown[] = []
    const successes: Shown[] = []
    let skipSuccess = false

    const makeSheet = (): Omit<Shown, 'proposal' | 'connection'> => {
        let resolveClosed = (): void => {}
        let rejectClosed = (_error: Error): void => {}
        const closed = new Promise<void>((resolve, reject) => {
            resolveClosed = resolve
            rejectClosed = reject
        })
        // Mirrors a sheet host: dismissing settles the request promise.
        const close = vi.fn(() => resolveClosed())
        return { sheet: { close, closed }, close, resolveClosed, rejectClosed }
    }

    const ui: ProposalQueueUi = {
        openApproval: vi.fn((proposal: ConnectionProposal) => {
            const shown = { ...makeSheet(), proposal }
            approvals.push(shown)
            return shown.sheet
        }),
        openSuccess: vi.fn((connection: Connection) => {
            if (skipSuccess) return null
            const shown = { ...makeSheet(), connection }
            successes.push(shown)
            return shown.sheet
        }),
    }
    return {
        ui,
        approvals,
        successes,
        skipSuccessSheet: () => {
            skipSuccess = true
        },
        /** The wrapped proposal the approval UI was handed. */
        wrapped: (index: number): ConnectionProposal =>
            approvals[index].proposal!,
    }
}

const flush = async (): Promise<void> => {
    for (let tick = 0; tick < 6; tick += 1) await Promise.resolve()
}

describe('createProposalQueue', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(1_000_000)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('opens an approval for an inbound proposal', () => {
        const { ui, approvals } = makeUi()
        const queue = createProposalQueue(ui)
        const proposal = makeProposal('p1')

        queue.enqueue(proposal)

        expect(ui.openApproval).toHaveBeenCalledTimes(1)
        expect(approvals[0].proposal?.proposalId).toBe('p1')
    })

    it('queues a second proposal while one is open instead of opening over it', () => {
        const { ui } = makeUi()
        const queue = createProposalQueue(ui)

        queue.enqueue(makeProposal('p1'))
        queue.enqueue(makeProposal('p2'))

        expect(ui.openApproval).toHaveBeenCalledTimes(1)
    })

    it('rejects a queued proposal that expired while waiting and never opens it', async () => {
        const { ui, wrapped } = makeUi()
        const queue = createProposalQueue(ui)
        queue.enqueue(makeProposal('p1'))
        const expired = makeProposal('p2')
        queue.enqueue(expired)
        const survivor = makeProposal('p3')
        queue.enqueue(survivor)
        vi.setSystemTime(expired.expiresAt + 1)
        survivor.expiresAt = Date.now() + 60_000

        await wrapped(0).reject('user cancelled')
        await flush()

        expect(expired.reject).toHaveBeenCalledWith('expired')
        expect(ui.openApproval).toHaveBeenCalledTimes(2)
        expect(vi.mocked(ui.openApproval).mock.calls[1][0].proposalId).toBe(
            'p3',
        )
    })

    it('dismisses, shows success, then opens the next proposal once approve succeeds', async () => {
        const { ui, approvals, successes, wrapped } = makeUi()
        const queue = createProposalQueue(ui)
        const first = makeProposal('p1')
        queue.enqueue(first)
        queue.enqueue(makeProposal('p2'))

        const connection = await wrapped(0).approve(['AAAA'])
        await flush()

        expect(first.approve).toHaveBeenCalledWith(['AAAA'])
        expect(connection.id).toBe('p1')
        expect(approvals[0].close).toHaveBeenCalledTimes(1)
        expect(ui.openSuccess).toHaveBeenCalledWith(connection)
        // Held: p2 waits for the "connected!" sheet.
        expect(ui.openApproval).toHaveBeenCalledTimes(1)

        successes[0].resolveClosed()
        await flush()

        expect(ui.openApproval).toHaveBeenCalledTimes(2)
        expect(vi.mocked(ui.openApproval).mock.calls[1][0].proposalId).toBe(
            'p2',
        )
    })

    it('holds a proposal that arrives while the success sheet is up', async () => {
        const { ui, successes, wrapped } = makeUi()
        const queue = createProposalQueue(ui)
        queue.enqueue(makeProposal('p1'))
        await wrapped(0).approve(['AAAA'])
        await flush()

        queue.enqueue(makeProposal('p2'))
        expect(ui.openApproval).toHaveBeenCalledTimes(1)

        successes[0].resolveClosed()
        await flush()
        expect(ui.openApproval).toHaveBeenCalledTimes(2)
    })

    it('moves on at once when the UI shows no success sheet', async () => {
        const { ui, skipSuccessSheet, wrapped } = makeUi()
        skipSuccessSheet()
        const queue = createProposalQueue(ui)
        queue.enqueue(makeProposal('p1'))
        queue.enqueue(makeProposal('p2'))

        await wrapped(0).approve(['AAAA'])

        expect(ui.openApproval).toHaveBeenCalledTimes(2)
    })

    it('still advances when the success sheet fails to show', async () => {
        const { ui, successes, wrapped } = makeUi()
        const queue = createProposalQueue(ui)
        queue.enqueue(makeProposal('p1'))
        queue.enqueue(makeProposal('p2'))

        await wrapped(0).approve(['AAAA'])
        successes[0].rejectClosed(new Error('no host'))
        await flush()

        expect(ui.openApproval).toHaveBeenCalledTimes(2)
    })

    it('keeps the sheet open when approve delivery fails so it can be retried', async () => {
        const { ui, approvals, wrapped } = makeUi()
        const queue = createProposalQueue(ui)
        const proposal = makeProposal('p1')
        proposal.approve.mockRejectedValue(new Error('delivery failed'))
        queue.enqueue(proposal)
        queue.enqueue(makeProposal('p2'))

        await expect(wrapped(0).approve(['AAAA'])).rejects.toThrow(
            'delivery failed',
        )
        await flush()

        expect(approvals[0].close).not.toHaveBeenCalled()
        expect(ui.openApproval).toHaveBeenCalledTimes(1)
    })

    it('always settles on reject, even when the peer cannot be reached', async () => {
        const { ui, approvals, wrapped } = makeUi()
        const queue = createProposalQueue(ui)
        const proposal = makeProposal('p1')
        proposal.reject.mockRejectedValue(new Error('dead socket'))
        queue.enqueue(proposal)
        queue.enqueue(makeProposal('p2'))

        await expect(wrapped(0).reject('user cancelled')).rejects.toThrow(
            'dead socket',
        )

        expect(approvals[0].close).toHaveBeenCalledTimes(1)
        expect(ui.openApproval).toHaveBeenCalledTimes(2)
    })

    it('ignores a stale second settle so it cannot dismiss the since-opened proposal', async () => {
        const { ui, approvals, wrapped } = makeUi()
        const queue = createProposalQueue(ui)
        queue.enqueue(makeProposal('p1'))
        queue.enqueue(makeProposal('p2'))
        const first = wrapped(0)

        await Promise.all([first.reject(), first.reject()])

        expect(approvals[0].close).toHaveBeenCalledTimes(1)
        expect(approvals[1].close).not.toHaveBeenCalled()
        expect(ui.openApproval).toHaveBeenCalledTimes(2)
    })

    it('releases the guard without dismissing when the approval never showed', async () => {
        const { ui, approvals } = makeUi()
        const queue = createProposalQueue(ui)
        queue.enqueue(makeProposal('p1'))
        queue.enqueue(makeProposal('p2'))

        approvals[0].rejectClosed(new Error('no host'))
        await flush()

        expect(approvals[0].close).not.toHaveBeenCalled()
        expect(ui.openApproval).toHaveBeenCalledTimes(2)
        expect(vi.mocked(ui.openApproval).mock.calls[1][0].proposalId).toBe(
            'p2',
        )
    })

    describe('closeForScope', () => {
        it('dismisses and rejects the open proposal for the errored pairing', async () => {
            const { ui, approvals } = makeUi()
            const queue = createProposalQueue(ui)
            const proposal = makeProposal('p1', 'pair-1')
            queue.enqueue(proposal)

            queue.closeForScope({ pairingId: 'pair-1' })

            expect(approvals[0].close).toHaveBeenCalledTimes(1)
            expect(proposal.reject).toHaveBeenCalledWith('connection error')
        })

        it('leaves another pairing open proposal alone', () => {
            const { ui, approvals } = makeUi()
            const queue = createProposalQueue(ui)
            queue.enqueue(makeProposal('p1', 'pair-1'))

            queue.closeForScope({ pairingId: 'pair-2' })
            queue.closeForScope({ connectionId: 'session-1' })

            expect(approvals[0].close).not.toHaveBeenCalled()
        })

        it('drops queued proposals for the subject and opens the next unrelated one', () => {
            const { ui } = makeUi()
            const queue = createProposalQueue(ui)
            queue.enqueue(makeProposal('p1', 'pair-1'))
            const doomed = makeProposal('p2', 'pair-1')
            queue.enqueue(doomed)
            queue.enqueue(makeProposal('p3', 'pair-9'))

            queue.closeForScope({ pairingId: 'pair-1' })

            expect(ui.openApproval).toHaveBeenCalledTimes(2)
            expect(vi.mocked(ui.openApproval).mock.calls[1][0].proposalId).toBe(
                'p3',
            )
            expect(doomed.reject).not.toHaveBeenCalled()
        })

        // The pairing became a session, so its errors carry the connection id.
        it('closes the success sheet when an error names the connection', async () => {
            const { ui, successes, wrapped } = makeUi()
            const queue = createProposalQueue(ui)
            queue.enqueue(makeProposal('p1', 'pair-1'))
            await wrapped(0).approve(['AAAA'])

            queue.closeForScope({ connectionId: 'p1' })

            expect(successes[0].close).toHaveBeenCalledTimes(1)
        })
    })

    describe('isRejectingOnError', () => {
        it('is true only while the rejection issued for the error is in flight', async () => {
            const { ui } = makeUi()
            const queue = createProposalQueue(ui)
            const proposal = makeProposal('p1', 'pair-1')
            let finishReject = (): void => {}
            proposal.reject.mockImplementation(
                () =>
                    new Promise<void>(resolve => {
                        finishReject = resolve
                    }),
            )
            queue.enqueue(proposal)
            expect(queue.isRejectingOnError({ pairingId: 'pair-1' })).toBe(
                false,
            )

            queue.closeForScope({ pairingId: 'pair-1' })

            expect(queue.isRejectingOnError({ pairingId: 'pair-1' })).toBe(true)
            // v1 reports the failure as the connection's once connected, and
            // the two share an id there.
            expect(queue.isRejectingOnError({ connectionId: 'pair-1' })).toBe(
                true,
            )
            expect(queue.isRejectingOnError({ pairingId: 'pair-2' })).toBe(
                false,
            )

            finishReject()
            await flush()

            expect(queue.isRejectingOnError({ pairingId: 'pair-1' })).toBe(
                false,
            )
        })
    })

    it('rejects the open and every queued proposal on teardown', () => {
        const { ui } = makeUi()
        const queue = createProposalQueue(ui)
        const proposals = [
            makeProposal('p1'),
            makeProposal('p2'),
            makeProposal('p3'),
        ]
        for (const proposal of proposals) queue.enqueue(proposal)

        queue.teardown()

        for (const proposal of proposals) {
            expect(proposal.reject).toHaveBeenCalledWith('provider torn down')
        }
    })
})
