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
import { renderHook } from '@testing-library/react'

const { networkMock } = vi.hoisted(() => ({
    networkMock: { current: 'mainnet' as 'mainnet' | 'testnet' },
}))

vi.mock('../useNetwork', () => ({
    useNetwork: () => ({ network: networkMock.current }),
}))

import { useOnNetworkSwitch } from '../useOnNetworkSwitch'

describe('useOnNetworkSwitch', () => {
    beforeEach(() => {
        networkMock.current = 'mainnet'
    })

    it('does not fire on the initial mount', () => {
        const handler = vi.fn()

        renderHook(() => useOnNetworkSwitch(handler))

        expect(handler).not.toHaveBeenCalled()
    })

    it('fires with (from, to) on a real network switch', () => {
        const handler = vi.fn()
        const { rerender } = renderHook(() => useOnNetworkSwitch(handler))

        networkMock.current = 'testnet'
        rerender()

        expect(handler).toHaveBeenCalledTimes(1)
        expect(handler).toHaveBeenCalledWith('mainnet', 'testnet')
    })

    it('does not fire on a rerender that does not change the network', () => {
        const handler = vi.fn()
        const { rerender } = renderHook(() => useOnNetworkSwitch(handler))

        rerender()
        rerender()

        expect(handler).not.toHaveBeenCalled()
    })

    it('invokes the latest handler', () => {
        const first = vi.fn()
        const second = vi.fn()
        const { rerender } = renderHook(
            ({ handler }) => useOnNetworkSwitch(handler),
            { initialProps: { handler: first } },
        )

        networkMock.current = 'testnet'
        rerender({ handler: second })

        expect(first).not.toHaveBeenCalled()
        expect(second).toHaveBeenCalledWith('mainnet', 'testnet')
    })
})
