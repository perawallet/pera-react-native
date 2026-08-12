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

// @vitest-environment node

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useReturnToDappStore } from '../useReturnToDappStore'

describe('useReturnToDappStore', () => {
    beforeEach(() => {
        useReturnToDappStore.getState().resetState()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('stores a context retrievable by clientId', () => {
        useReturnToDappStore.getState().setReturnContext('client-1', {
            origin: 'external-browser',
            browserName: 'chrome',
        })

        expect(
            useReturnToDappStore.getState().returnContexts['client-1'],
        ).toMatchObject({ browserName: 'chrome' })
    })

    it('stores a context without a browser name (Android raw wc: link)', () => {
        useReturnToDappStore
            .getState()
            .setReturnContext('client-1', { origin: 'qr' })

        const context =
            useReturnToDappStore.getState().returnContexts['client-1']
        expect(context).toBeDefined()
        expect(context.browserName).toBeUndefined()
    })

    it('clearReturnContext removes only the given entry', () => {
        const { setReturnContext, clearReturnContext } =
            useReturnToDappStore.getState()
        setReturnContext('client-1', {
            origin: 'external-browser',
            browserName: 'chrome',
        })
        setReturnContext('client-2', {
            origin: 'external-browser',
            browserName: 'firefox',
        })

        clearReturnContext('client-1')

        const { returnContexts } = useReturnToDappStore.getState()
        expect(returnContexts['client-1']).toBeUndefined()
        expect(returnContexts['client-2']).toMatchObject({
            browserName: 'firefox',
        })
    })

    it('resetState empties the store', () => {
        useReturnToDappStore
            .getState()
            .setReturnContext('client-1', { origin: 'qr' })

        useReturnToDappStore.getState().resetState()

        expect(useReturnToDappStore.getState().returnContexts).toEqual({})
    })

    it('prunes entries older than ten minutes on a later write', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-08-11T10:00:00Z'))
        useReturnToDappStore
            .getState()
            .setReturnContext('stale', { origin: 'external-browser' })

        vi.setSystemTime(new Date('2026-08-11T10:11:00Z'))
        useReturnToDappStore
            .getState()
            .setReturnContext('fresh', { origin: 'external-browser' })

        const { returnContexts } = useReturnToDappStore.getState()
        expect(returnContexts['stale']).toBeUndefined()
        expect(returnContexts['fresh']).toBeDefined()
    })
})
