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

import { describe, it, expect, vi } from 'vitest'
import {
    forgetSettled,
    notifySubmissionSettled,
    watchSubmissionOutcome,
} from '../ledger-events'

let next = 0
const freshId = () => `tx-${next++}`

describe('watchSubmissionOutcome', () => {
    it('reports confirmed once when the attempt settles confirmed', () => {
        const id = freshId()
        const onOutcome = vi.fn()
        watchSubmissionOutcome(id, onOutcome)

        notifySubmissionSettled([id], 'confirmed')
        notifySubmissionSettled([id], 'confirmed')

        expect(onOutcome).toHaveBeenCalledTimes(1)
        expect(onOutcome).toHaveBeenCalledWith('confirmed')
    })

    it('reports failed when the attempt settles failed', () => {
        const id = freshId()
        const onOutcome = vi.fn()
        watchSubmissionOutcome(id, onOutcome)

        notifySubmissionSettled([id, freshId()], 'failed')

        expect(onOutcome).toHaveBeenCalledWith('failed')
    })

    it('never reports a replaced attempt, even if it later settles', () => {
        const id = freshId()
        const onOutcome = vi.fn()
        watchSubmissionOutcome(id, onOutcome)

        notifySubmissionSettled([id], 'replaced')
        notifySubmissionSettled([id], 'confirmed')

        expect(onOutcome).not.toHaveBeenCalled()
    })

    it('answers at once when the attempt settled before the watch', () => {
        const id = freshId()
        notifySubmissionSettled([id], 'confirmed')
        const onOutcome = vi.fn()

        watchSubmissionOutcome(id, onOutcome)

        expect(onOutcome).toHaveBeenCalledWith('confirmed')
    })

    it('stays silent for an evicted txId that settled before the watch', () => {
        const old = freshId()
        notifySubmissionSettled([old], 'confirmed')
        for (let i = 0; i < 257; i++) {
            notifySubmissionSettled([freshId()], 'confirmed')
        }
        const onOutcome = vi.fn()

        watchSubmissionOutcome(old, onOutcome)
        notifySubmissionSettled(['unrelated'], 'confirmed')

        expect(onOutcome).not.toHaveBeenCalled()
    })

    it('keeps notifying other watchers when one throws', () => {
        const a = freshId()
        const b = freshId()
        const onB = vi.fn()
        watchSubmissionOutcome(a, () => {
            throw new Error('boom')
        })
        watchSubmissionOutcome(b, onB)

        notifySubmissionSettled([a, b], 'confirmed')

        expect(onB).toHaveBeenCalledWith('confirmed')
    })

    it('does not replay an earlier settle once a new attempt for the txId is recorded', () => {
        const id = freshId()
        notifySubmissionSettled([id], 'failed')
        forgetSettled([id])
        const onOutcome = vi.fn()

        watchSubmissionOutcome(id, onOutcome)
        expect(onOutcome).not.toHaveBeenCalled()

        notifySubmissionSettled([id], 'confirmed')
        expect(onOutcome).toHaveBeenCalledWith('confirmed')
    })
})
