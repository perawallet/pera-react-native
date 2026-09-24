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

import { afterEach, describe, expect, it } from 'vitest'
import { DOUBLE_PRESS_GUARD_MS } from '@components/core/PWTouchableOpacity/PWTouchableOpacity'
import {
    closestPressable,
    getAllPressables,
    getInputErrorMessage,
    getSwitchControl,
    isElementDisabled,
    longPress,
    queryPressableByText,
    waitPastDoublePressGuard,
} from '../rnw'

const mount = (html: string): HTMLElement => {
    const host = document.createElement('div')
    host.innerHTML = html
    document.body.appendChild(host)
    return host
}

describe('rnw test helpers', () => {
    afterEach(() => {
        document.body.innerHTML = ''
    })

    it('reads disabled from aria-disabled or a native disabled attribute', () => {
        const host = mount(`
            <div id="aria" aria-disabled="true" tabindex="-1"></div>
            <button id="native" disabled></button>
            <div id="enabled" tabindex="0"></div>
        `)

        expect(isElementDisabled(host.querySelector('#aria')!)).toBe(true)
        expect(isElementDisabled(host.querySelector('#native')!)).toBe(true)
        expect(isElementDisabled(host.querySelector('#enabled')!)).toBe(false)
    })

    it('matches a label to the innermost pressable that holds it', () => {
        const host = mount(`
            <div id="row" tabindex="0">
                <span>Row title</span>
                <div id="action" tabindex="0"><span id="label">Remove</span></div>
            </div>
        `)

        expect(getAllPressables(host)).toHaveLength(2)
        expect(closestPressable(host.querySelector('#label')!)?.id).toBe(
            'action',
        )
        expect(queryPressableByText('Remove')?.id).toBe('action')
        expect(queryPressableByText('Row title')?.id).toBe('row')
        expect(queryPressableByText('Missing')).toBeNull()
    })

    it("reads an input's error from its `-error` sibling and treats an empty one as none", () => {
        const host = mount(`
            <input data-testid="email" />
            <div data-testid="email-error">Invalid email</div>
            <input data-testid="name" />
            <div data-testid="name-error"></div>
        `)

        expect(
            getInputErrorMessage(host.querySelector('[data-testid="email"]')!),
        ).toBe('Invalid email')
        expect(
            getInputErrorMessage(host.querySelector('[data-testid="name"]')!),
        ).toBeNull()
    })

    it('finds the checkbox inside a switch wrapper', () => {
        const host = mount(`
            <div data-testid="toggle"><input type="checkbox" role="switch" checked /></div>
        `)

        const control = getSwitchControl(
            host.querySelector('[data-testid="toggle"]')!,
        )

        expect(control.checked).toBe(true)
        expect(() => getSwitchControl(document.createElement('div'))).toThrow()
    })

    it('holds the press long enough before releasing it', async () => {
        const host = mount('<div tabindex="0"></div>')
        const target = host.firstElementChild!
        const events: Array<{ type: string; at: number }> = []
        target.addEventListener('mousedown', () =>
            events.push({ type: 'down', at: Date.now() }),
        )
        target.addEventListener('mouseup', () =>
            events.push({ type: 'up', at: Date.now() }),
        )

        await longPress(target)

        expect(events.map(event => event.type)).toEqual(['down', 'up'])
        expect(events[1].at - events[0].at).toBeGreaterThanOrEqual(450)
    })

    it('waits out the double-press guard', async () => {
        const startedAt = Date.now()

        await waitPastDoublePressGuard()

        expect(Date.now() - startedAt).toBeGreaterThanOrEqual(
            DOUBLE_PRESS_GUARD_MS,
        )
    })
})
