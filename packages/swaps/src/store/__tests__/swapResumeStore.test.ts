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

import { describe, expect, it, beforeEach } from 'vitest'
import { useSwapResumeStore } from '../swapResumeStore'

describe('useSwapResumeStore', () => {
    beforeEach(() => {
        useSwapResumeStore.getState().resetState()
    })

    it('returns nothing for an unknown quote', () => {
        expect(useSwapResumeStore.getState().getResume('quote-1')).toBeUndefined()
    })

    it('records and reads back a resume record', () => {
        useSwapResumeStore.getState().recordResume({
            quoteId: 'quote-1',
            swapId: 'swap-1',
            groups: ['g1', 'g2'],
            groupStates: [
                { status: 'landed', txIds: ['TX-1'] },
                { status: 'pending', txIds: [] },
            ],
        })

        const record = useSwapResumeStore.getState().getResume('quote-1')

        expect(record).toMatchObject({
            quoteId: 'quote-1',
            swapId: 'swap-1',
            groups: ['g1', 'g2'],
        })
        expect(record?.createdAt).toBeTypeOf('number')
    })

    it('replaces an earlier record for the same quote', () => {
        const { recordResume, getResume } = useSwapResumeStore.getState()
        recordResume({
            quoteId: 'quote-1',
            groups: ['g1'],
            groupStates: [{ status: 'pending', txIds: [] }],
        })
        recordResume({
            quoteId: 'quote-1',
            groups: ['g1'],
            groupStates: [{ status: 'landed', txIds: ['TX-1'] }],
        })

        expect(getResume('quote-1')?.groupStates).toEqual([
            { status: 'landed', txIds: ['TX-1'] },
        ])
    })

    it('clears one quote without touching another', () => {
        const { recordResume, clearResume, getResume } =
            useSwapResumeStore.getState()
        recordResume({
            quoteId: 'quote-1',
            groups: ['g1'],
            groupStates: [{ status: 'pending', txIds: [] }],
        })
        recordResume({
            quoteId: 'quote-2',
            groups: ['g2'],
            groupStates: [{ status: 'pending', txIds: [] }],
        })

        clearResume('quote-1')

        expect(getResume('quote-1')).toBeUndefined()
        expect(getResume('quote-2')).toBeDefined()
    })
})
