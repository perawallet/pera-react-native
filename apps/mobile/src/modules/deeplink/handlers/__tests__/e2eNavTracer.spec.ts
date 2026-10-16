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

vi.mock('expo-file-system', () => ({ File: vi.fn(), Paths: {} }))

import { doubleOpens, flattenRoutes, focusedPath } from '../e2eNavTracer'

const state = {
    type: 'stack',
    index: 1,
    routes: [
        { key: 't', name: 'TabBar' },
        {
            key: 'c',
            name: 'Contacts',
            state: {
                type: 'stack',
                index: 2,
                routes: [
                    { key: 'l', name: 'ContactsList' },
                    { key: 'v1', name: 'ViewContact' },
                    { key: 'v2', name: 'ViewContact' },
                ],
            },
        },
    ],
}

describe('e2eNavTracer', () => {
    it('lists every mounted route with its full path', () => {
        expect(flattenRoutes(state).map(route => route.path)).toEqual([
            'TabBar',
            'Contacts',
            'Contacts/ContactsList',
            'Contacts/ViewContact',
            'Contacts/ViewContact',
        ])
    })

    it('follows the focused route down every navigator', () => {
        expect(focusedPath(state)).toBe('Contacts/ViewContact')
    })

    it('reports the same screen pushed twice in one stack', () => {
        expect(doubleOpens(state)).toEqual(['Contacts/ViewContact#v2'])
    })

    it('does not report a screen that repeats in different stacks', () => {
        expect(
            doubleOpens({
                type: 'tab',
                routes: [
                    { key: 'a', name: 'Home' },
                    { key: 'b', name: 'Home' },
                ],
            }),
        ).toEqual([])
    })
})
