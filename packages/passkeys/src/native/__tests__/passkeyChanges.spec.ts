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
import {
    notifyPasskeyChanged,
    subscribeToPasskeyChanges,
} from '../passkeyChanges'

describe('passkey change notifications', () => {
    it('tells every subscriber about a change', () => {
        const first = vi.fn()
        const second = vi.fn()
        const unsubscribeFirst = subscribeToPasskeyChanges(first)
        const unsubscribeSecond = subscribeToPasskeyChanges(second)

        notifyPasskeyChanged()

        expect(first).toHaveBeenCalledTimes(1)
        expect(second).toHaveBeenCalledTimes(1)
        unsubscribeFirst()
        unsubscribeSecond()
    })

    it('stops telling a subscriber once it unsubscribes', () => {
        const listener = vi.fn()
        const unsubscribe = subscribeToPasskeyChanges(listener)

        unsubscribe()
        notifyPasskeyChanged()

        expect(listener).not.toHaveBeenCalled()
    })
})
