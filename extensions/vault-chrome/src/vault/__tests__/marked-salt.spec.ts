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

import { describe, expect, it } from 'vitest'
import { createMarkedSalt, isMarkedSalt, readSaltMarks } from '../marked-salt'

describe('marked salt', () => {
    it('creates a 16-byte salt that carries the mark', () => {
        const salt = createMarkedSalt()

        expect(salt).toHaveLength(16)
        expect(isMarkedSalt(salt)).toBe(true)
    })

    it('carries both marks by default and randomises everything after them', () => {
        const salt = createMarkedSalt()

        expect(readSaltMarks(salt)).toEqual({
            isKvSealed: true,
            isKeystoreResealed: true,
        })
        expect(salt.slice(8)).not.toEqual(createMarkedSalt().slice(8))
    })

    it('carries each mark on its own', () => {
        const kvOnly = { isKvSealed: true, isKeystoreResealed: false }
        const keystoreOnly = { isKvSealed: false, isKeystoreResealed: true }

        expect(readSaltMarks(createMarkedSalt(kvOnly))).toEqual(kvOnly)
        expect(readSaltMarks(createMarkedSalt(keystoreOnly))).toEqual(
            keystoreOnly,
        )
    })

    it('does not treat an unmarked salt as marked', () => {
        expect(isMarkedSalt(new Uint8Array(16).fill(4))).toBe(false)
    })

    it('does not treat a salt of the wrong length as marked', () => {
        expect(isMarkedSalt(createMarkedSalt().slice(0, 8))).toBe(false)
    })
})
