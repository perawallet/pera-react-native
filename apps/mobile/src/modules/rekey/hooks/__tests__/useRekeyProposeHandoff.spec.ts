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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

let capturedHandler: (() => void) | null = null
vi.mock('@perawallet/wallet-core-signing', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-signing')
    >()),
    useSigningEvent: (_predicate: unknown, handler: () => void) => {
        capturedHandler = handler
    },
}))

import { useRekeyProposeHandoff } from '../useRekeyProposeHandoff'

describe('useRekeyProposeHandoff', () => {
    beforeEach(() => {
        capturedHandler = null
    })

    it('does not invoke onProposed for a propose event before submit is marked', () => {
        const onProposed = vi.fn()
        renderHook(() => useRekeyProposeHandoff(onProposed))

        act(() => capturedHandler?.())

        expect(onProposed).not.toHaveBeenCalled()
    })

    it('invokes onProposed once after submit is marked, and flags the handoff', () => {
        const onProposed = vi.fn()
        const { result } = renderHook(() => useRekeyProposeHandoff(onProposed))

        act(() => result.current.markSubmitted())
        act(() => capturedHandler?.())
        // A second propose event must not re-trigger the handoff.
        act(() => capturedHandler?.())

        expect(onProposed).toHaveBeenCalledTimes(1)
        expect(result.current.hasHandedOff()).toBe(true)
    })
})
