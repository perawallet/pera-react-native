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

const { consumedFlow, mockFinishTabResume } = vi.hoisted(() => ({
    consumedFlow: { current: null as string | null },
    mockFinishTabResume: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-browser-runtime', () => ({
    getConsumedExpandedFlow: () => consumedFlow.current,
    finishTabResume: mockFinishTabResume,
}))

import {
    clearTabResumeIntent,
    completeTabResume,
    peekTabResumeIntent,
    registerTabResumeIntent,
} from '../tabResumeIntent.web'

const SWAP_INTENT = {
    flow: 'swap',
    accountAddress: 'ADDR',
    assetInId: '0',
    assetOutId: '31566704',
    payAmount: '1.5',
} as const

describe('tabResumeIntent (web)', () => {
    beforeEach(() => {
        clearTabResumeIntent()
        consumedFlow.current = null
        mockFinishTabResume.mockReset()
        mockFinishTabResume.mockResolvedValue(undefined)
    })

    it('holds the intent of the flow that is signing', () => {
        registerTabResumeIntent(SWAP_INTENT)

        expect(peekTabResumeIntent()).toEqual(SWAP_INTENT)
    })

    it('forgets it once the flow clears it, so a later error resumes nothing', () => {
        registerTabResumeIntent(SWAP_INTENT)

        clearTabResumeIntent()

        expect(peekTabResumeIntent()).toBeNull()
    })

    it('hands a finished flow back to the popup only from a resume tab', () => {
        const result = { title: 'Swap Complete', body: 'done' }

        completeTabResume(result)
        expect(mockFinishTabResume).not.toHaveBeenCalled()

        consumedFlow.current = 'resume'
        completeTabResume(result)
        expect(mockFinishTabResume).toHaveBeenCalledWith(result)
    })

    it('stays quiet when the worker refuses, leaving the tab on its own toast', async () => {
        consumedFlow.current = 'resume'
        mockFinishTabResume.mockRejectedValue(new Error('port closed'))

        expect(() =>
            completeTabResume({ title: 'Swap Complete', body: 'done' }),
        ).not.toThrow()
        await new Promise(resolve => setTimeout(resolve, 0))
    })
})
