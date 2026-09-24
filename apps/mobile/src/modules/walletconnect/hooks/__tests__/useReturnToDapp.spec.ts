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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { BackHandler, Linking, Platform } from 'react-native'
import { buildIosBrowserFocusUrl, useReturnToDapp } from '../useReturnToDapp'

const setPlatform = (os: string) => {
    ;(Platform as { OS: string }).OS = os
}

describe('buildIosBrowserFocusUrl', () => {
    // Bare launch schemes, no URL payload: focusing must never navigate,
    // or the dApp page reloads and drops its in-flight state (QA finding
    // on).
    it.each([
        ['Chrome', 'googlechrome://'],
        ['chrome', 'googlechrome://'],
        ['Firefox', 'firefox://'],
        ['Brave', 'brave://'],
        ['Microsoft Edge', 'microsoft-edge://'],
    ])('maps %s to its bare launch scheme', (browserName, expected) => {
        expect(buildIosBrowserFocusUrl(browserName)).toBe(expected)
    })

    it('returns null for browsers without a focus-only scheme', () => {
        expect(buildIosBrowserFocusUrl('Mobile Safari')).toBeNull()
        expect(buildIosBrowserFocusUrl('Safari')).toBeNull()
        expect(buildIosBrowserFocusUrl('DuckDuckGo')).toBeNull()
        expect(buildIosBrowserFocusUrl('Opera')).toBeNull()
        expect(buildIosBrowserFocusUrl('NetFront')).toBeNull()
        expect(buildIosBrowserFocusUrl(undefined)).toBeNull()
    })
})

describe('useReturnToDapp', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        setPlatform('ios')
    })

    describe('Android', () => {
        beforeEach(() => setPlatform('android'))

        it('can always return (the browser task is right behind us)', () => {
            const { result } = renderHook(() => useReturnToDapp())
            expect(result.current.canReturnToDapp({})).toBe(true)
        })

        it('returns by sending the app task to the back', async () => {
            const { result } = renderHook(() => useReturnToDapp())

            await result.current.returnToDapp({})

            expect(BackHandler.exitApp).toHaveBeenCalledTimes(1)
            expect(Linking.openURL).not.toHaveBeenCalled()
        })
    })

    describe('iOS', () => {
        it('can return only when the browser hint maps to a focus scheme', () => {
            const { result } = renderHook(() => useReturnToDapp())
            expect(
                result.current.canReturnToDapp({ browserName: 'Chrome' }),
            ).toBe(true)
            expect(result.current.canReturnToDapp({})).toBe(false)
            expect(
                result.current.canReturnToDapp({
                    browserName: 'Mobile Safari',
                }),
            ).toBe(false)
        })

        it('focuses the initiating browser without navigating it', async () => {
            vi.mocked(Linking.openURL).mockResolvedValue(true)
            const { result } = renderHook(() => useReturnToDapp())

            await result.current.returnToDapp({ browserName: 'Chrome' })

            expect(Linking.openURL).toHaveBeenCalledTimes(1)
            expect(Linking.openURL).toHaveBeenCalledWith('googlechrome://')
            expect(BackHandler.exitApp).not.toHaveBeenCalled()
        })

        it('never navigates anywhere when the focus scheme fails (navigation reloads the dapp page)', async () => {
            vi.mocked(Linking.openURL).mockRejectedValue(
                new Error('no handler'),
            )
            const { result } = renderHook(() => useReturnToDapp())

            // Even when a caller still supplies a dapp url, a failed focus
            // must not degrade into navigation — that re-navigation is the
            // page reload QA reported (and the guaranteed path on
            // simulators, where the hinted browser can't be installed).
            await expect(
                result.current.returnToDapp({
                    browserName: 'Chrome',
                    dappUrl: 'https://app.example.org/swap?x=1',
                } as Parameters<
                    ReturnType<typeof useReturnToDapp>['returnToDapp']
                >[0]),
            ).resolves.toBeUndefined()

            expect(Linking.openURL).toHaveBeenCalledTimes(1)
            expect(Linking.openURL).toHaveBeenCalledWith('googlechrome://')
        })

        it('does nothing for browsers without a focus scheme', async () => {
            const { result } = renderHook(() => useReturnToDapp())

            await result.current.returnToDapp({
                browserName: 'Mobile Safari',
            })

            expect(Linking.openURL).not.toHaveBeenCalled()
        })
    })
})
