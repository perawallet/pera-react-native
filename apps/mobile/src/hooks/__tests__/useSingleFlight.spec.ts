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

import { act, renderHook } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useSingleFlight } from '../useSingleFlight'

const deferred = <T>() => {
    let resolve: (value: T) => void = () => {}
    const promise = new Promise<T>(r => {
        resolve = r
    })
    return { promise, resolve }
}

describe('useSingleFlight', () => {
    it('drops a call made while one is running, even in the same frame', async () => {
        const { result } = renderHook(() => useSingleFlight())
        const held = deferred<string>()
        const second = vi.fn(async () => 'second')

        let first: Promise<string | undefined> = Promise.resolve(undefined)
        let dropped: Promise<string | undefined> = Promise.resolve(undefined)
        act(() => {
            first = result.current.run(() => held.promise)
            dropped = result.current.run(second)
        })

        await expect(dropped).resolves.toBeUndefined()
        expect(second).not.toHaveBeenCalled()
        await act(async () => {
            held.resolve('first')
        })
        await expect(first).resolves.toBe('first')
    })

    it('reports the pending key while running and clears it after', async () => {
        const { result } = renderHook(() => useSingleFlight<'a' | 'b'>())
        const held = deferred<void>()

        let running: Promise<void> = Promise.resolve()
        act(() => {
            running = result.current.run(() => held.promise, 'b').then(() => {})
        })
        expect(result.current.isPending).toBe(true)
        expect(result.current.pendingKey).toBe('b')

        await act(async () => {
            held.resolve()
            await running
        })
        expect(result.current.isPending).toBe(false)
        expect(result.current.pendingKey).toBeUndefined()
    })

    it('accepts a new call once a failed one has settled', async () => {
        const { result } = renderHook(() => useSingleFlight())

        await act(async () => {
            await expect(
                result.current.run(() => Promise.reject(new Error('boom'))),
            ).rejects.toThrow('boom')
        })

        await act(async () => {
            await expect(result.current.run(async () => 'next')).resolves.toBe(
                'next',
            )
        })
        expect(result.current.isPending).toBe(false)
    })
})
