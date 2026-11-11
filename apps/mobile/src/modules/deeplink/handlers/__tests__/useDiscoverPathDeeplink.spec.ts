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
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    navigateToScreen: vi.fn(),
    errorToast: vi.fn(),
}))

vi.mock('../../navigateToScreen', () => ({
    navigateToScreen: mocks.navigateToScreen,
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ errorToast: mocks.errorToast }),
}))

vi.mock('@hooks/useLanguage')

import { useDiscoverPathDeeplink } from '../useDiscoverPathDeeplink'

describe('useDiscoverPathDeeplink', () => {
    const run = (path?: string) =>
        renderHook(() => useDiscoverPathDeeplink()).result.current({
            path,
            sourceUrl: 'perawallet://discover',
            replaceCurrentScreen: false,
        })

    it('opens the Discover home for no path', () => {
        expect(run(undefined)).toBe(true)
        expect(mocks.navigateToScreen).toHaveBeenCalledWith(false, 'TabBar', {
            screen: 'Discover',
        })
    })

    it('opens the WebView detail for a regular path', () => {
        expect(run('/markets')).toBe(true)
        expect(mocks.navigateToScreen).toHaveBeenCalledWith(
            false,
            'DiscoverDetail',
            { path: '/markets' },
        )
    })

    it('opens native asset details for a token-detail path', () => {
        expect(run('token-detail/31566704')).toBe(true)
        expect(mocks.navigateToScreen).toHaveBeenCalledWith(false, 'TabBar', {
            screen: 'Home',
            params: {
                screen: 'AssetDetails',
                params: { assetId: '31566704', chainId: 'algorand' },
            },
        })
    })

    it('rejects an unsafe path with a toast', () => {
        const onError = vi.fn()
        const { result } = renderHook(() => useDiscoverPathDeeplink())
        const handled = result.current({
            path: '//evil.example.com',
            sourceUrl: 'perawallet://discover?path=//evil.example.com',
            replaceCurrentScreen: false,
            onError,
        })
        expect(handled).toBe(false)
        expect(mocks.errorToast).toHaveBeenCalled()
        expect(onError).toHaveBeenCalled()
        expect(mocks.navigateToScreen).not.toHaveBeenCalled()
    })
})
