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

import { describe, expect, it } from 'vitest'
import { DecodingError, EncodingError, UnlockingError } from './errors.ts'

describe('errors.ts', () => {
    it('DecodingError sets name and message', () => {
        const error = new DecodingError('test message')
        expect(error.message).toBe('test message')
        expect(error.name).toBe('DecodingError')
    })

    it('DecodingError sets cause if provided', () => {
        const cause = new Error('cause')
        const error = new DecodingError('msg', cause)
        expect(error.cause).toBe(cause)
    })

    it('EncodingError sets name and message', () => {
        const error = new EncodingError('test message')
        expect(error.message).toBe('test message')
        expect(error.name).toBe('EncodingError')
    })

    it('UnlockingError sets name and message', () => {
        const error = new UnlockingError('test message')
        expect(error.message).toBe('test message')
        expect(error.name).toBe('UnlockingError')
    })
})
