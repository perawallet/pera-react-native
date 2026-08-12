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
import { buildIosBrowserReturnUrl, useReturnToDapp } from '../useReturnToDapp'

const DAPP_URL = 'https://app.example.org/swap?x=1'

const setPlatform = (os: string) => {
    ;(Platform as { OS: string }).OS = os
}

describe('buildIosBrowserReturnUrl', () => {
    it.each([
        ['Chrome', 'googlechromes://app.example.org/swap?x=1'],
        ['chrome', 'googlechromes://app.example.org/swap?x=1'],
        ['Firefox', `firefox://open-url?url=${encodeURIComponent(DAPP_URL)}`],
        ['Brave', `brave://open-url?url=${encodeURIComponent(DAPP_URL)}`],
        ['Microsoft Edge', 'microsoft-edge-https://app.example.org/swap?x=1'],
        ['Opera', 'touch-https://app.example.org/swap?x=1'],
    ])('maps %s to its URL scheme', (browserName, expected) => {
        expect(buildIosBrowserReturnUrl(browserName, DAPP_URL)).toBe(expected)
    })

    it('uses the insecure chrome scheme for http URLs', () => {
        expect(
            buildIosBrowserReturnUrl('Chrome', 'http://app.example.org/'),
        ).toBe('googlechrome://app.example.org/')
    })

    it('returns null for Safari (plain https open is the correct path)', () => {
        expect(buildIosBrowserReturnUrl('Mobile Safari', DAPP_URL)).toBeNull()
        expect(buildIosBrowserReturnUrl('Safari', DAPP_URL)).toBeNull()
    })

    it('returns null for unknown browsers and missing names', () => {
        expect(buildIosBrowserReturnUrl('NetFront', DAPP_URL)).toBeNull()
        expect(buildIosBrowserReturnUrl(undefined, DAPP_URL)).toBeNull()
    })

    it('returns null for a non-http dapp url', () => {
        expect(
            buildIosBrowserReturnUrl('Chrome', 'javascript:alert(1)'),
        ).toBeNull()
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
        it('cannot return without a valid http(s) dapp url', () => {
            const { result } = renderHook(() => useReturnToDapp())
            expect(result.current.canReturnToDapp({})).toBe(false)
            expect(
                result.current.canReturnToDapp({
                    browserName: 'Chrome',
                    dappUrl: 'not-a-url',
                }),
            ).toBe(false)
        })

        it('cannot return without a browser hint (no task stack to fall back on)', () => {
            const { result } = renderHook(() => useReturnToDapp())
            expect(result.current.canReturnToDapp({ dappUrl: DAPP_URL })).toBe(
                false,
            )
        })

        it('can return when both the browser hint and a valid dapp url exist', () => {
            const { result } = renderHook(() => useReturnToDapp())
            expect(
                result.current.canReturnToDapp({
                    browserName: 'Mobile Safari',
                    dappUrl: DAPP_URL,
                }),
            ).toBe(true)
        })

        it('opens the initiating browser via its scheme', async () => {
            vi.mocked(Linking.openURL).mockResolvedValue(true)
            const { result } = renderHook(() => useReturnToDapp())

            await result.current.returnToDapp({
                browserName: 'Chrome',
                dappUrl: DAPP_URL,
            })

            expect(Linking.openURL).toHaveBeenCalledWith(
                'googlechromes://app.example.org/swap?x=1',
            )
            expect(BackHandler.exitApp).not.toHaveBeenCalled()
        })

        it('falls back to the plain https url when the browser scheme fails', async () => {
            vi.mocked(Linking.openURL)
                .mockRejectedValueOnce(new Error('no handler'))
                .mockResolvedValueOnce(true)
            const { result } = renderHook(() => useReturnToDapp())

            await result.current.returnToDapp({
                browserName: 'Chrome',
                dappUrl: DAPP_URL,
            })

            expect(Linking.openURL).toHaveBeenNthCalledWith(
                1,
                'googlechromes://app.example.org/swap?x=1',
            )
            expect(Linking.openURL).toHaveBeenNthCalledWith(2, DAPP_URL)
        })

        it('opens the dapp url directly for Safari', async () => {
            vi.mocked(Linking.openURL).mockResolvedValue(true)
            const { result } = renderHook(() => useReturnToDapp())

            await result.current.returnToDapp({
                browserName: 'Mobile Safari',
                dappUrl: DAPP_URL,
            })

            expect(Linking.openURL).toHaveBeenCalledTimes(1)
            expect(Linking.openURL).toHaveBeenCalledWith(DAPP_URL)
        })

        it('never throws into the caller when every open fails', async () => {
            vi.mocked(Linking.openURL).mockRejectedValue(
                new Error('no handler'),
            )
            const { result } = renderHook(() => useReturnToDapp())

            await expect(
                result.current.returnToDapp({
                    browserName: 'Chrome',
                    dappUrl: DAPP_URL,
                }),
            ).resolves.toBeUndefined()
        })
    })
})
