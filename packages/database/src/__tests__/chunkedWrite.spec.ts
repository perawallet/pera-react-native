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

import { describe, it, expect } from 'vitest'
import { DB_WRITE_CHUNK_SIZE, forEachWriteChunk } from '../chunkedWrite'

describe('forEachWriteChunk', () => {
    it('writes rows in chunks of DB_WRITE_CHUNK_SIZE, in order', async () => {
        const rows = Array.from(
            { length: DB_WRITE_CHUNK_SIZE * 2 + 1 },
            (_, i) => i,
        )
        const chunks: number[][] = []

        await forEachWriteChunk(rows, async chunk => {
            chunks.push(chunk)
        })

        expect(DB_WRITE_CHUNK_SIZE).toBe(200)
        expect(chunks.map(c => c.length)).toEqual([200, 200, 1])
        expect(chunks.flat()).toEqual(rows)
    })

    it('waits for each write before starting the next', async () => {
        const events: string[] = []

        await forEachWriteChunk(
            [1, 2, 3],
            async chunk => {
                events.push(`start ${chunk[0]}`)
                await Promise.resolve()
                events.push(`end ${chunk[0]}`)
            },
            1,
        )

        expect(events).toEqual([
            'start 1',
            'end 1',
            'start 2',
            'end 2',
            'start 3',
            'end 3',
        ])
    })

    it('does not call write for an empty input', async () => {
        let calls = 0

        await forEachWriteChunk([], async () => {
            calls++
        })

        expect(calls).toBe(0)
    })

    it('stops at the first failed chunk', async () => {
        const seen: number[] = []

        await expect(
            forEachWriteChunk(
                [1, 2, 3],
                async chunk => {
                    seen.push(chunk[0])
                    if (chunk[0] === 2) throw new Error('boom')
                },
                1,
            ),
        ).rejects.toThrow('boom')

        expect(seen).toEqual([1, 2])
    })
})
