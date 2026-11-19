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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { deviceChainAdapters } from '../../registrations/chain-adapter'
import { useChainsDeviceCanMute } from '../useChainsDeviceCanMute'

const mocks = vi.hoisted(() => ({
    isV4: true,
    refusedChains: new Set<string>(),
}))

// Refusal is decided here; the real module still notifies subscribers.
vi.mock('@perawallet/wallet-core-config', async importOriginal => ({
    ...(await importOriginal<object>()),
    isPeraScopeRefused: ({ chainId }: { chainId: string }) =>
        mocks.refusedChains.has(chainId),
}))

vi.mock('../registrationApi', () => ({
    isDeviceRegistrationV4Enabled: () => mocks.isV4,
}))

const register = (chainId: ChainId, canMuteChain?: boolean) =>
    deviceChainAdapters.register({
        chainId,
        accountTypeOf: () => 'hdWallet',
        rankOf: () => 0,
        ...(canMuteChain === undefined ? {} : { canMuteChain }),
    })

describe('useChainsDeviceCanMute', () => {
    beforeEach(() => {
        mocks.isV4 = true
        mocks.refusedChains.clear()
        deviceChainAdapters.reset()
    })

    it('lists the chains whose adapter can mute, in registry order', () => {
        register('ethereum', true)
        register('algorand', true)

        const { result } = renderHook(() => useChainsDeviceCanMute())

        expect(result.current).toEqual(['algorand', 'ethereum'])
    })

    it('leaves out a chain whose adapter does not say it can mute', () => {
        register('algorand')
        register('ethereum', true)

        const { result } = renderHook(() => useChainsDeviceCanMute())

        expect(result.current).toEqual(['ethereum'])
    })

    it('is empty while v4 registration is off, and follows the flag when it flips', () => {
        register('ethereum', true)
        mocks.isV4 = false
        const { result, rerender } = renderHook(() => useChainsDeviceCanMute())
        expect(result.current).toEqual([])

        mocks.isV4 = true
        rerender()

        expect(result.current).toEqual(['ethereum'])
    })

    it('keeps its identity while the set is unchanged', () => {
        register('ethereum', true)
        const { result, rerender } = renderHook(() => useChainsDeviceCanMute())
        const first = result.current

        rerender()

        expect(result.current).toBe(first)
    })

    it('drops a chain once its network is refused, without another render cause', async () => {
        const { markPeraScopeRefused } =
            await import('@perawallet/wallet-core-config')
        register('algorand', true)
        register('ethereum', true)
        const { result } = renderHook(() => useChainsDeviceCanMute())
        expect(result.current).toEqual(['algorand', 'ethereum'])

        mocks.refusedChains.add('ethereum')
        act(() => {
            markPeraScopeRefused({ chainId: 'ethereum', networkId: 'mainnet' })
        })

        expect(result.current).toEqual(['algorand'])
    })
})
