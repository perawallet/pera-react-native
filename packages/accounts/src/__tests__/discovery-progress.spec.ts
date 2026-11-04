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
import { createWalletDiscoveryTracker } from '../discovery-progress'
import type { ProbedHdIndex } from '../hd-walk'
import { ALGORAND, BASE, ETHEREUM } from './chainFamilies'

const CHAIN_IDS = [ALGORAND, ETHEREUM, BASE]

const foundAt = (account: number, keyIndex = 0): ProbedHdIndex => ({
    index: { account, keyIndex },
    derived: {},
    active: {},
})

const setUp = (isHeld: (found: ProbedHdIndex) => boolean = () => false) => {
    const onProgress = vi.fn()
    const tracker = createWalletDiscoveryTracker({
        chainIds: CHAIN_IDS,
        onProgress,
        isHeld,
    })
    return { tracker, onProgress }
}

const lastProgress = (onProgress: ReturnType<typeof vi.fn>) =>
    onProgress.mock.calls.at(-1)![0]

describe('createWalletDiscoveryTracker', () => {
    it('reports every chain as soon as it is created', () => {
        const { onProgress } = setUp()

        expect(onProgress).toHaveBeenCalledExactlyOnceWith({
            chainIds: CHAIN_IDS,
            failedChainIds: [],
            checkedAccountCount: 0,
            foundCount: 0,
        })
    })

    it.each(['failed', 'partial'] as const)(
        'moves a chain that settled %s into the failed chains, keeping its row',
        outcome => {
            const { tracker, onProgress } = setUp()

            tracker.onProbeSettled(ETHEREUM, outcome)

            expect(lastProgress(onProgress)).toMatchObject({
                chainIds: CHAIN_IDS,
                failedChainIds: [ETHEREUM],
            })
        },
    )

    it('drops a refused chain from the rows without calling it failed', () => {
        const { tracker, onProgress } = setUp()

        tracker.onProbeSettled(BASE, 'refused')

        expect(lastProgress(onProgress)).toMatchObject({
            chainIds: [ALGORAND, ETHEREUM],
            failedChainIds: [],
        })
        expect(tracker.failedChainIds(false)).not.toContain(BASE)
    })

    it('counts the checked accounts as the highest probed account index plus one', () => {
        const { tracker, onProgress } = setUp()

        tracker.onBatchProbed([
            { account: 0, keyIndex: 0 },
            { account: 4, keyIndex: 1 },
        ])
        tracker.onBatchProbed([{ account: 2, keyIndex: 0 }])

        expect(lastProgress(onProgress).checkedAccountCount).toBe(5)
    })

    it('counts a found index once, and not one the wallet already holds', () => {
        const { tracker, onProgress } = setUp(
            ({ index }) => index.account === 1,
        )

        tracker.onFound([foundAt(0), foundAt(1)])
        tracker.onFound([foundAt(0), foundAt(2)])

        expect(lastProgress(onProgress).foundCount).toBe(2)
    })

    describe('failedChainIds', () => {
        it('names the chains that failed or were partly answered, in walk order', () => {
            const { tracker } = setUp()
            tracker.onProbeSettled(ALGORAND, 'answered')
            tracker.onProbeSettled(BASE, 'partial')
            tracker.onProbeSettled(ETHEREUM, 'failed')

            expect(tracker.failedChainIds(false)).toEqual([ETHEREUM, BASE])
        })

        it('keeps a chain that failed once as failed although it answered in another batch', () => {
            const { tracker } = setUp()
            tracker.onProbeSettled(ALGORAND, 'answered')
            tracker.onProbeSettled(BASE, 'answered')
            tracker.onProbeSettled(ETHEREUM, 'answered')
            tracker.onProbeSettled(ETHEREUM, 'failed')

            expect(tracker.failedChainIds(false)).toEqual([ETHEREUM])
        })

        it('counts a chain the walk never reached, unless a cancel stopped it first', () => {
            const { tracker } = setUp()
            tracker.onProbeSettled(ALGORAND, 'answered')

            expect(tracker.failedChainIds(false)).toEqual([ETHEREUM, BASE])
            expect(tracker.failedChainIds(true)).toEqual([])
        })
    })

    describe('coverage', () => {
        it('is unanswered when no chain answered a batch', () => {
            const { tracker } = setUp()
            tracker.onProbeSettled(ALGORAND, 'failed')

            expect(tracker.coverage(tracker.failedChainIds(false), false)).toBe(
                'unanswered',
            )
        })

        it('is partial when a chain answered but another failed, or the walk was cut short', () => {
            const { tracker } = setUp()
            tracker.onProbeSettled(ALGORAND, 'answered')
            tracker.onProbeSettled(ETHEREUM, 'failed')
            tracker.onProbeSettled(BASE, 'answered')

            expect(tracker.coverage([ETHEREUM], false)).toBe('partial')
            expect(tracker.coverage([], true)).toBe('partial')
        })

        it('is complete when every chain answered', () => {
            const { tracker } = setUp()
            for (const chainId of CHAIN_IDS) {
                tracker.onProbeSettled(chainId, 'answered')
            }

            expect(tracker.coverage([], false)).toBe('complete')
        })

        it('is complete, not unanswered, when every chain was refused', () => {
            const { tracker } = setUp()
            for (const chainId of CHAIN_IDS) {
                tracker.onProbeSettled(chainId, 'refused')
            }

            expect(tracker.coverage([], false)).toBe('complete')
        })
    })
})
