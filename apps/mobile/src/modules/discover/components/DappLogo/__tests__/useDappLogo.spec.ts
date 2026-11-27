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
import { describe, expect, it } from 'vitest'
import { useDappLogo } from '../useDappLogo'

describe('useDappLogo', () => {
    it('shows the logo and never asks the site while there is one', () => {
        const { result } = renderHook(() =>
            useDappLogo({
                logo: 'https://pera.test/tinyman.png',
                siteUrl: 'https://app.tinyman.org/swap',
            }),
        )

        expect(result.current.uri).toBe('https://pera.test/tinyman.png')

        act(() => result.current.handleError())

        expect(result.current.uri).toBeNull()
    })

    it('shows the globe for a dApp with no logo and no site to ask', () => {
        const { result } = renderHook(() => useDappLogo({ logo: null }))

        expect(result.current.uri).toBeNull()
    })

    it('tries the site icons in turn, then falls back to the globe', () => {
        const { result } = renderHook(() =>
            useDappLogo({
                logo: null,
                siteUrl: 'https://Revoke.cash/address?chain=1',
            }),
        )

        expect(result.current.uri).toBe(
            'https://revoke.cash/apple-touch-icon.png',
        )

        act(() => result.current.handleError())
        expect(result.current.uri).toBe('https://revoke.cash/favicon.ico')

        act(() => result.current.handleError())
        expect(result.current.uri).toBeNull()
    })

    it('never asks a site that is not https', () => {
        const { result } = renderHook(() =>
            useDappLogo({ logo: null, siteUrl: 'http://revoke.cash' }),
        )

        expect(result.current.uri).toBeNull()
    })

    it('starts over when the cell is reused for another dApp', () => {
        const { result, rerender } = renderHook(
            ({ siteUrl }) => useDappLogo({ logo: null, siteUrl }),
            { initialProps: { siteUrl: 'https://revoke.cash' } },
        )
        act(() => result.current.handleError())
        act(() => result.current.handleError())
        expect(result.current.uri).toBeNull()

        rerender({ siteUrl: 'https://aave.org' })

        expect(result.current.uri).toBe('https://aave.org/apple-touch-icon.png')
    })
})
