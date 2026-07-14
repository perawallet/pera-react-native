/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, expect, it } from 'vitest'
import { getQueryRenderState } from '../query-render-state'

describe('getQueryRenderState', () => {
    it('reports resolved data with no active render flags on success', () => {
        const state = getQueryRenderState({
            data: 42,
            error: null,
            status: 'success',
            fetchStatus: 'idle',
        })

        expect(state.data).toBe(42)
        expect(state.isPending).toBe(false)
        expect(state.isPaused).toBe(false)
        expect(state.isFetching).toBe(false)
        expect(state.isError).toBe(false)
    })

    it('flags isPaused (not isPending) when offline with no cached data', () => {
        const state = getQueryRenderState({
            data: undefined,
            error: null,
            status: 'pending',
            fetchStatus: 'paused',
        })

        // Offline-with-no-cache must render the offline surface, NOT the
        // initial skeleton — so isPaused wins and isPending stays false.
        expect(state.isPaused).toBe(true)
        expect(state.isPending).toBe(false)
        expect(state.isFetching).toBe(false)
        expect(state.data).toBeUndefined()
    })

    it('exposes cached data while paused', () => {
        const state = getQueryRenderState({
            data: 'cached',
            error: null,
            status: 'success',
            fetchStatus: 'paused',
        })

        expect(state.isPaused).toBe(true)
        expect(state.data).toBe('cached')
    })

    it('flags isFetching while a fetch is in flight', () => {
        const state = getQueryRenderState({
            data: undefined,
            error: null,
            status: 'pending',
            fetchStatus: 'fetching',
        })

        expect(state.isFetching).toBe(true)
        expect(state.isPending).toBe(false)
        expect(state.isPaused).toBe(false)
    })

    it('flags isPending only for a cold idle load with no data', () => {
        const state = getQueryRenderState({
            data: undefined,
            error: null,
            status: 'pending',
            fetchStatus: 'idle',
        })

        expect(state.isPending).toBe(true)
        expect(state.isPaused).toBe(false)
        expect(state.isFetching).toBe(false)
    })

    it('flags isError and surfaces the error for retry', () => {
        const error = new Error('boom')
        const state = getQueryRenderState({
            data: undefined,
            error,
            status: 'error',
            fetchStatus: 'idle',
        })

        expect(state.isError).toBe(true)
        expect(state.error).toBe(error)
    })
})
