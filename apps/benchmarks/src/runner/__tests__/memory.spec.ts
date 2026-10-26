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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { collectGarbage, readHeap } from '../memory'

const setMemory = (memory: Record<string, number> | undefined): void => {
    Object.defineProperty(globalThis.performance, 'memory', {
        value: memory,
        configurable: true,
    })
}

afterEach(() => {
    setMemory(undefined)
    vi.unstubAllGlobals()
})

describe('readHeap', () => {
    it('is null when the runtime has no performance.memory, never a flat 0 MB', () => {
        setMemory(undefined)

        expect(readHeap()).toBeNull()
    })

    it('reads the used and total heap in MB', () => {
        setMemory({
            usedJSHeapSize: 5 * 1024 * 1024,
            totalJSHeapSize: 8 * 1024 * 1024,
        })

        expect(readHeap()).toEqual({ usedMb: 5, totalMb: 8 })
    })

    it('adds allocations and GC count only where Hermes reports them', () => {
        setMemory({ usedJSHeapSize: 1024 * 1024, totalJSHeapSize: 1024 * 1024 })
        vi.stubGlobal('HermesInternal', {
            getInstrumentedStats: () => ({
                js_totalAllocatedBytes: 2 * 1024 * 1024,
                js_numGCs: 7,
            }),
        })

        expect(readHeap()).toMatchObject({ allocatedMb: 2, gcCount: 7 })
    })
})

describe('collectGarbage', () => {
    it('runs gc where the engine exposes it', () => {
        const gc = vi.fn()
        vi.stubGlobal('gc', gc)

        collectGarbage()

        expect(gc).toHaveBeenCalledOnce()
    })

    it('does nothing where it does not', () => {
        expect(() => collectGarbage()).not.toThrow()
    })
})
