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

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
    setOnConfirmedHandler,
    getOnConfirmedHandler,
} from '../onConfirmedRegistry'

afterEach(() => {
    // The registry is module-level singleton state; clear it so cases stay
    // independent.
    setOnConfirmedHandler(null)
})

describe('onConfirmedRegistry', () => {
    it('returns null when no handler has been registered', () => {
        expect(getOnConfirmedHandler()).toBeNull()
    })

    it('returns the handler that was registered', () => {
        const handler = vi.fn()

        setOnConfirmedHandler(handler)

        expect(getOnConfirmedHandler()).toBe(handler)
    })

    it('the latest registration wins', () => {
        const first = vi.fn()
        const second = vi.fn()

        setOnConfirmedHandler(first)
        setOnConfirmedHandler(second)

        expect(getOnConfirmedHandler()).toBe(second)
    })

    it('clears the handler when registered with null', () => {
        setOnConfirmedHandler(vi.fn())
        setOnConfirmedHandler(null)

        expect(getOnConfirmedHandler()).toBeNull()
    })
})
