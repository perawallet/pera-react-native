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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    navigateToScreen: vi.fn(),
    errorToast: vi.fn(),
    capabilities: { discoverTab: true },
}))

vi.mock('../../navigateToScreen', () => ({
    navigateToScreen: mocks.navigateToScreen,
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ errorToast: mocks.errorToast }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@routes/capabilities', () => ({
    get routeCapabilities() {
        return mocks.capabilities
    },
}))

import { useDiscoverPathDeeplink } from '../useDiscoverPathDeeplink'

describe('useDiscoverPathDeeplink', () => {
    beforeEach(() => {
        mocks.capabilities.discoverTab = true
    })

    it('navigates into the Discover tab when the capability is on', () => {
        const { result } = renderHook(() => useDiscoverPathDeeplink())
        const handled = result.current({
            path: '/markets',
            sourceUrl: 'perawallet://discover?path=/markets',
            replaceCurrentScreen: false,
        })
        expect(handled).toBe(true)
        expect(mocks.navigateToScreen).toHaveBeenCalledWith(false, 'TabBar', {
            screen: 'Discover',
            params: { path: '/markets' },
        })
    })

    it('returns false, toasts, and calls onError when discoverTab is off', () => {
        mocks.capabilities.discoverTab = false
        const onError = vi.fn()
        const { result } = renderHook(() => useDiscoverPathDeeplink())
        const handled = result.current({
            path: '/markets',
            sourceUrl: 'perawallet://discover?path=/markets',
            replaceCurrentScreen: false,
            onError,
        })
        expect(handled).toBe(false)
        expect(mocks.navigateToScreen).not.toHaveBeenCalled()
        expect(mocks.errorToast).toHaveBeenCalled()
        expect(onError).toHaveBeenCalledOnce()
    })

    it('rejects an unsafe path before considering the capability', () => {
        const onError = vi.fn()
        const { result } = renderHook(() => useDiscoverPathDeeplink())
        const handled = result.current({
            path: '//evil.example.com',
            sourceUrl: 'perawallet://discover?path=//evil.example.com',
            replaceCurrentScreen: false,
            onError,
        })
        expect(handled).toBe(false)
        expect(mocks.navigateToScreen).not.toHaveBeenCalled()
    })
})
