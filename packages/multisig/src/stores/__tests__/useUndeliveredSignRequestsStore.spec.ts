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

import { beforeEach, describe, expect, it } from 'vitest'
import {
    UNDELIVERED_SIGN_REQUEST_LIMIT,
    useUndeliveredSignRequestsStore,
} from '../useUndeliveredSignRequestsStore'

describe('useUndeliveredSignRequestsStore', () => {
    beforeEach(() => {
        useUndeliveredSignRequestsStore.getState().resetState()
    })

    it('reports an unmarked request as deliverable', () => {
        expect(
            useUndeliveredSignRequestsStore.getState().isUndelivered('sr-1'),
        ).toBe(false)
    })

    it('remembers a request marked undeliverable', () => {
        useUndeliveredSignRequestsStore.getState().markUndelivered('sr-1')

        expect(
            useUndeliveredSignRequestsStore.getState().isUndelivered('sr-1'),
        ).toBe(true)
    })

    it('clears a marked request', () => {
        useUndeliveredSignRequestsStore.getState().markUndelivered('sr-1')
        useUndeliveredSignRequestsStore.getState().clearUndelivered('sr-1')

        expect(
            useUndeliveredSignRequestsStore.getState().isUndelivered('sr-1'),
        ).toBe(false)
    })

    it('drops the oldest ids past the retention limit', () => {
        // Bounded so a long-lived install can't accumulate markers forever.
        // Each id belongs to one dead request, so eviction only loses a
        // banner on an ancient request, never mislabels a new one.
        const total = UNDELIVERED_SIGN_REQUEST_LIMIT + 5
        for (let index = 0; index < total; index += 1) {
            useUndeliveredSignRequestsStore
                .getState()
                .markUndelivered(`sr-${index}`)
        }

        const state = useUndeliveredSignRequestsStore.getState()
        expect(state.isUndelivered('sr-0')).toBe(false)
        expect(state.isUndelivered(`sr-${total - 1}`)).toBe(true)
        expect(state.signRequestIds).toHaveLength(
            UNDELIVERED_SIGN_REQUEST_LIMIT,
        )
    })

    it('does not duplicate a re-marked id', () => {
        useUndeliveredSignRequestsStore.getState().markUndelivered('sr-1')
        useUndeliveredSignRequestsStore.getState().markUndelivered('sr-1')

        expect(
            useUndeliveredSignRequestsStore.getState().signRequestIds,
        ).toEqual(['sr-1'])
    })
})
