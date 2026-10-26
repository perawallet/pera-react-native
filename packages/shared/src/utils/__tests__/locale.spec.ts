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

import { describe, it, expect, afterEach, vi } from 'vitest'
import {
    getActiveLocale,
    setActiveLocale,
    subscribeActiveLocale,
} from '../locale'

describe('utils/locale', () => {
    afterEach(() => {
        setActiveLocale('en')
    })

    it('defaults to en before anything sets it', () => {
        expect(getActiveLocale()).toBe('en')
    })

    it('returns whatever was last set', () => {
        setActiveLocale('de')
        expect(getActiveLocale()).toBe('de')

        setActiveLocale('pt-BR')
        expect(getActiveLocale()).toBe('pt-BR')
    })

    it('notifies subscribers on a change but not when the same locale is set again', () => {
        const listener = vi.fn()
        const unsubscribe = subscribeActiveLocale(listener)

        setActiveLocale('de')
        setActiveLocale('de')

        expect(listener).toHaveBeenCalledTimes(1)
        unsubscribe()
    })

    it('stops notifying after unsubscribe', () => {
        const listener = vi.fn()
        subscribeActiveLocale(listener)()

        setActiveLocale('tr')

        expect(listener).not.toHaveBeenCalled()
    })
})
