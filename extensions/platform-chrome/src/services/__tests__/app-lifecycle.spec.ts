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
import { runAppLifecycleContract } from '../../../../platform/src/test-utils/app-lifecycle-contract'
import { ChromeAppLifecycleService } from '../app-lifecycle'

// The driver tests run in node; this stands in for the DOM document.
class FakeDocument extends EventTarget {
    visibilityState = 'visible'
}

let fakeDocument: FakeDocument

const setVisibility = (next: string): void => {
    fakeDocument.visibilityState = next
    fakeDocument.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
    fakeDocument = new FakeDocument()
    vi.stubGlobal('document', fakeDocument)
})

afterEach(() => {
    vi.unstubAllGlobals()
})

runAppLifecycleContract('ChromeAppLifecycleService', () => ({
    service: new ChromeAppLifecycleService(),
    emit: state => setVisibility(state === 'active' ? 'visible' : 'hidden'),
}))

describe('ChromeAppLifecycleService', () => {
    it.each(['hidden', 'prerender', 'unloaded'])(
        'reports %s as background',
        state => {
            fakeDocument.visibilityState = state

            expect(new ChromeAppLifecycleService().getCurrentState()).toBe(
                'background',
            )
        },
    )

    it('binds a single document listener however many subscribers join', () => {
        const addEventListener = vi.spyOn(fakeDocument, 'addEventListener')
        const service = new ChromeAppLifecycleService()

        service.addChangeListener(() => {})
        service.addChangeListener(() => {})

        expect(
            addEventListener.mock.calls.filter(
                ([type]) => type === 'visibilitychange',
            ),
        ).toHaveLength(1)
    })

    it('reads as active and never emits without a document', () => {
        const service = new ChromeAppLifecycleService()
        vi.stubGlobal('document', undefined)
        const listener = vi.fn()

        expect(service.getCurrentState()).toBe('active')
        const unsubscribe = service.addChangeListener(listener)
        expect(() => unsubscribe()).not.toThrow()
        expect(listener).not.toHaveBeenCalled()
    })
})
