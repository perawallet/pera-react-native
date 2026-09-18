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

import { describe, expect, it, vi } from 'vitest'
import { SubmissionError } from '@perawallet/wallet-core-signing'
import { submitSwapGroups } from '../submitSwapGroups'

const algodError = {
    code: 'network_unavailable',
    message: 'offline',
} as never

const unknownOutcome = (txIds: string[]) =>
    new SubmissionError(txIds, 'unknown-outcome', algodError)

const rejected = (txIds: string[]) =>
    new SubmissionError(txIds, 'rejected-by-node', algodError)

describe('submitSwapGroups', () => {
    it('submits every group in order and aggregates their txIds', async () => {
        const submitGroup = vi
            .fn()
            .mockResolvedValueOnce(['TX-1'])
            .mockResolvedValueOnce(['TX-2'])

        const result = await submitSwapGroups({
            groups: ['g1', 'g2'],
            swapId: 'swap-1',
            submitGroup,
        })

        expect(result).toEqual({
            kind: 'all-submitted',
            txIds: ['TX-1', 'TX-2'],
            groupStates: [
                { status: 'landed', txIds: ['TX-1'] },
                { status: 'landed', txIds: ['TX-2'] },
            ],
        })
        expect(submitGroup).toHaveBeenNthCalledWith(1, 'g1', {
            intentKey: { kind: 'swap', swapId: 'swap-1', group: 0 },
        })
        expect(submitGroup).toHaveBeenNthCalledWith(2, 'g2', {
            intentKey: { kind: 'swap', swapId: 'swap-1', group: 1 },
        })
    })

    it('omits the intent key entirely when there is no swap id', async () => {
        const submitGroup = vi.fn().mockResolvedValue(['TX-1'])

        await submitSwapGroups({ groups: ['g1'], submitGroup })

        expect(submitGroup).toHaveBeenCalledWith('g1', { intentKey: undefined })
    })

    it('reports a failure before anything broadcast as failed', async () => {
        const error = rejected([])
        const submitGroup = vi.fn().mockRejectedValue(error)

        const result = await submitSwapGroups({
            groups: ['g1', 'g2'],
            swapId: 'swap-1',
            submitGroup,
        })

        expect(result).toEqual({ kind: 'failed', error })
        expect(submitGroup).toHaveBeenCalledTimes(1)
    })

    it('reports a mid-loop failure as partial, keeping the landed txIds', async () => {
        const error = rejected([])
        const submitGroup = vi
            .fn()
            .mockResolvedValueOnce(['TX-1'])
            .mockRejectedValueOnce(error)

        const result = await submitSwapGroups({
            groups: ['g1', 'g2'],
            swapId: 'swap-1',
            submitGroup,
        })

        expect(result).toEqual({
            kind: 'partial',
            txIds: ['TX-1'],
            groupStates: [
                { status: 'landed', txIds: ['TX-1'] },
                { status: 'pending', txIds: [] },
            ],
            error,
        })
    })

    it('treats an unknown-outcome group as landed and carries its txIds', async () => {
        const error = unknownOutcome(['TX-2'])
        const submitGroup = vi
            .fn()
            .mockResolvedValueOnce(['TX-1'])
            .mockRejectedValueOnce(error)

        const result = await submitSwapGroups({
            groups: ['g1', 'g2'],
            swapId: 'swap-1',
            submitGroup,
        })

        expect(result).toMatchObject({
            kind: 'partial',
            txIds: ['TX-1', 'TX-2'],
            groupStates: [
                { status: 'landed', txIds: ['TX-1'] },
                { status: 'landed', txIds: ['TX-2'] },
            ],
        })
    })

    it('reports a first-group unknown outcome as partial, not failed', async () => {
        const submitGroup = vi.fn().mockRejectedValue(unknownOutcome(['TX-1']))

        const result = await submitSwapGroups({
            groups: ['g1', 'g2'],
            swapId: 'swap-1',
            submitGroup,
        })

        expect(result).toMatchObject({ kind: 'partial', txIds: ['TX-1'] })
    })

    it('skips groups already landed in the resume state', async () => {
        const submitGroup = vi.fn().mockResolvedValue(['TX-2'])

        const result = await submitSwapGroups({
            groups: ['g1', 'g2'],
            swapId: 'swap-1',
            submitGroup,
            resume: [
                { status: 'landed', txIds: ['TX-1'] },
                { status: 'pending', txIds: [] },
            ],
        })

        expect(submitGroup).toHaveBeenCalledTimes(1)
        expect(submitGroup).toHaveBeenCalledWith('g2', {
            intentKey: { kind: 'swap', swapId: 'swap-1', group: 1 },
        })
        expect(result).toEqual({
            kind: 'all-submitted',
            txIds: ['TX-1', 'TX-2'],
            groupStates: [
                { status: 'landed', txIds: ['TX-1'] },
                { status: 'landed', txIds: ['TX-2'] },
            ],
        })
    })

    it('submits nothing when every group already landed', async () => {
        const submitGroup = vi.fn()

        const result = await submitSwapGroups({
            groups: ['g1', 'g2'],
            swapId: 'swap-1',
            submitGroup,
            resume: [
                { status: 'landed', txIds: ['TX-1'] },
                { status: 'landed', txIds: ['TX-2'] },
            ],
        })

        expect(submitGroup).not.toHaveBeenCalled()
        expect(result).toMatchObject({
            kind: 'all-submitted',
            txIds: ['TX-1', 'TX-2'],
        })
    })

    it('skips empty groups without consuming a submit call', async () => {
        const submitGroup = vi.fn().mockResolvedValue(['TX-2'])

        const result = await submitSwapGroups({
            groups: [[], 'g2'] as never,
            swapId: 'swap-1',
            submitGroup,
            isEmptyGroup: group => Array.isArray(group) && group.length === 0,
        })

        expect(submitGroup).toHaveBeenCalledTimes(1)
        expect(result).toMatchObject({ kind: 'all-submitted', txIds: ['TX-2'] })
    })
})
