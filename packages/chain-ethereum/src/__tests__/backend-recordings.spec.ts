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
import { z } from 'zod'
import {
    expectEveryRowParses,
    readBackendRecording,
} from './backend-recordings'

const rowSchema = z.object({ id: z.string() })

describe('expectEveryRowParses', () => {
    it('throws on an empty list', () => {
        expect(() => expectEveryRowParses([], rowSchema)).toThrow(
            'The recording has no rows to check',
        )
    })

    it('throws naming the first row the schema rejects', () => {
        const rows = [{ id: 'a' }, { id: 2 }]

        expect(() => expectEveryRowParses(rows, rowSchema)).toThrow(
            /Row 1 no longer parses/,
        )
    })

    it('passes when every row parses', () => {
        expect(() =>
            expectEveryRowParses([{ id: 'a' }, { id: 'b' }], rowSchema),
        ).not.toThrow()
    })
})

describe('readBackendRecording', () => {
    it('reads a recording with its request', () => {
        const recording = readBackendRecording('assets')

        expect(recording.request.path).toEqual(expect.any(String))
    })
})
