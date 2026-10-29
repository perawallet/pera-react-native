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

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useNetworkStore } from '../../store/network-store'
import { useOnDeploymentSwitch } from '../useOnDeploymentSwitch'

describe('useOnDeploymentSwitch', () => {
    beforeEach(() => {
        useNetworkStore.getState().resetState()
    })

    it('does not fire on the initial mount', () => {
        const handler = vi.fn()

        renderHook(() => useOnDeploymentSwitch(handler))

        expect(handler).not.toHaveBeenCalled()
    })

    it('fires with (from, to) once on a real deployment change', () => {
        const handler = vi.fn()
        renderHook(() => useOnDeploymentSwitch(handler))

        act(() => useNetworkStore.getState().setMode('developer'))

        expect(handler).toHaveBeenCalledTimes(1)
        expect(handler).toHaveBeenCalledWith('live', 'developer')
    })

    it('does not fire when only a chain network changes inside developer mode', () => {
        const handler = vi.fn()
        act(() => useNetworkStore.getState().setMode('developer'))
        renderHook(() => useOnDeploymentSwitch(handler))

        act(() =>
            useNetworkStore.getState().selectNetwork('algorand', 'betanet'),
        )

        expect(handler).not.toHaveBeenCalled()
    })

    it('invokes the latest handler', () => {
        const first = vi.fn()
        const second = vi.fn()
        const { rerender } = renderHook(
            ({ handler }) => useOnDeploymentSwitch(handler),
            { initialProps: { handler: first } },
        )

        rerender({ handler: second })
        act(() => useNetworkStore.getState().setMode('developer'))

        expect(first).not.toHaveBeenCalled()
        expect(second).toHaveBeenCalledWith('live', 'developer')
    })
})
