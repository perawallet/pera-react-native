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

import { describe, it, expect } from 'vitest'
import { RekeyError } from '../RekeyError'

describe('RekeyError', () => {
    it('tags the failed stage as the reason', () => {
        const error = new RekeyError('submission_failed')

        expect(error).toBeInstanceOf(Error)
        expect(error.name).toBe('RekeyError')
        expect(error.reason).toBe('submission_failed')
    })

    it('preserves the original cause for downstream translation', () => {
        const cause = new Error('algod unreachable')
        const error = new RekeyError('submission_failed', cause)

        expect(error.originalError).toBe(cause)
    })

    it('leaves originalError undefined when no cause is given', () => {
        const error = new RekeyError('user_rejected')

        expect(error.originalError).toBeUndefined()
    })

    it('normalizes a non-Error cause to an Error', () => {
        // Caught values are not guaranteed to be Error instances.
        const error = new RekeyError('build_failed', 'something broke')

        expect(error.originalError).toBeInstanceOf(Error)
        expect(error.originalError?.message).toBe('something broke')
    })
})
