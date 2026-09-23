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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createChromeFake, type ChromeFake } from '../test-utils/chrome'
import {
    onLocalStorageKeyChanged,
    onSessionStorageKeyChanged,
} from '../storage-events'

describe('onLocalStorageKeyChanged', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('fires the listener for a watched key changed in the local area', () => {
        const listener = vi.fn()
        onLocalStorageKeyChanged(['watched-key'], listener)
        fake.emitExternalChange('watched-key', 'new-value', 'local')
        expect(listener).toHaveBeenCalledTimes(1)
        expect(listener).toHaveBeenCalledWith('watched-key')
    })

    it('ignores keys that are not in the watched set', () => {
        const listener = vi.fn()
        onLocalStorageKeyChanged(['watched-key'], listener)
        fake.emitExternalChange('other-key', 'new-value', 'local')
        expect(listener).not.toHaveBeenCalled()
    })

    it('ignores changes outside the local area', () => {
        const listener = vi.fn()
        onLocalStorageKeyChanged(['watched-key'], listener)
        fake.emitExternalChange('watched-key', 'new-value', 'session')
        expect(listener).not.toHaveBeenCalled()
    })

    it('stops firing after unsubscribe', () => {
        const listener = vi.fn()
        const unsubscribe = onLocalStorageKeyChanged(['watched-key'], listener)
        unsubscribe()
        fake.emitExternalChange('watched-key', 'new-value', 'local')
        expect(listener).not.toHaveBeenCalled()
    })
})

describe('onSessionStorageKeyChanged', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('fires the listener for a watched key changed in the session area', () => {
        const listener = vi.fn()
        onSessionStorageKeyChanged(['watched-key'], listener)
        fake.emitExternalChange('watched-key', 'new-value', 'session')
        expect(listener).toHaveBeenCalledTimes(1)
        expect(listener).toHaveBeenCalledWith('watched-key')
    })

    it('ignores changes outside the session area', () => {
        const listener = vi.fn()
        onSessionStorageKeyChanged(['watched-key'], listener)
        fake.emitExternalChange('watched-key', 'new-value', 'local')
        expect(listener).not.toHaveBeenCalled()
    })
})
