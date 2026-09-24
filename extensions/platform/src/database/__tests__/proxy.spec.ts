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
import { createDrizzleProxyCallback } from '../proxy'

describe('createDrizzleProxyCallback', () => {
    const rows = [
        [1, 'a'],
        [2, 'b'],
    ]

    it.each(['run', 'all', 'values'] as const)(
        'passes the row arrays through for %s',
        async method => {
            const exec = vi.fn().mockResolvedValue(rows)
            const callback = createDrizzleProxyCallback(exec)

            const result = await callback('SELECT 1', [7], method)

            expect(exec).toHaveBeenCalledWith('SELECT 1', [7], method)
            expect(result).toEqual({ rows })
        },
    )

    it('unwraps the first row for get', async () => {
        const callback = createDrizzleProxyCallback(
            vi.fn().mockResolvedValue(rows),
        )

        expect(await callback('SELECT 1', [], 'get')).toEqual({
            rows: [1, 'a'],
        })
    })

    it('resolves rows to undefined for a get with no match', async () => {
        const callback = createDrizzleProxyCallback(
            vi.fn().mockResolvedValue([]),
        )

        expect((await callback('SELECT 1', [], 'get')).rows).toBeUndefined()
    })

    it('propagates executor failures', async () => {
        const callback = createDrizzleProxyCallback(
            vi.fn().mockRejectedValue(new Error('no such table: x')),
        )

        await expect(callback('SELECT 1', [], 'all')).rejects.toThrow(
            'no such table: x',
        )
    })
})
