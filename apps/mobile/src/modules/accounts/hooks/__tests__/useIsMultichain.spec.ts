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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIsMultichain } from '../useIsMultichain'

const mocks = vi.hoisted(() => ({
    registered: [] as string[],
    switchedOff: [] as string[],
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useRegisteredChainIds: () => mocks.registered,
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useSwitchedOffChainIds: () => mocks.switchedOff,
}))

describe('useIsMultichain', () => {
    beforeEach(() => {
        mocks.switchedOff = []
    })

    it('is false when one chain is registered', () => {
        mocks.registered = ['algorand']

        const { result } = renderHook(() => useIsMultichain())

        expect(result.current).toBe(false)
    })

    it('is true when a second chain is registered and on', () => {
        mocks.registered = ['algorand', 'ethereum']

        const { result } = renderHook(() => useIsMultichain())

        expect(result.current).toBe(true)
    })

    it('stays true when only some other chains are switched off', () => {
        mocks.registered = ['algorand', 'ethereum', 'base']
        mocks.switchedOff = ['base']

        const { result } = renderHook(() => useIsMultichain())

        expect(result.current).toBe(true)
    })

    it('is false when every other chain is switched off', () => {
        mocks.registered = ['algorand', 'ethereum', 'base']
        mocks.switchedOff = ['ethereum', 'base']

        const { result } = renderHook(() => useIsMultichain())

        expect(result.current).toBe(false)
    })
})
