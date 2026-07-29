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

import { describe, test, expect } from 'vitest'
import { isValidEndpoint } from '../isValidEndpoint'

describe('isValidEndpoint', () => {
    test('accepts an http URL', () => {
        expect(isValidEndpoint('http://10.0.0.5:4001')).toBe(true)
    })

    test('accepts an https URL', () => {
        expect(isValidEndpoint('https://fnet-api.4160.nodely.dev')).toBe(true)
    })

    test('rejects a non-http(s) protocol', () => {
        expect(isValidEndpoint('ftp://example.com')).toBe(false)
    })

    test('rejects a malformed URL rather than throwing', () => {
        expect(isValidEndpoint('not-a-url')).toBe(false)
    })

    test('rejects an empty string', () => {
        expect(isValidEndpoint('')).toBe(false)
    })
})
