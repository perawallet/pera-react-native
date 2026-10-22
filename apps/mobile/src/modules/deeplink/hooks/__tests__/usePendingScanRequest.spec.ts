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
import { AppState } from 'react-native'
import { act, renderHook, waitFor } from '@testing-library/react'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { usePendingScanRequest } from '../usePendingScanRequest'

const handleDeepLink = vi.hoisted(() => vi.fn())

vi.mock('../useDeepLink', () => ({
    useDeepLink: () => ({ handleDeepLink }),
}))

const consumePendingScan = () =>
    getProvider().widgets.consumePendingScan as unknown as ReturnType<
        typeof vi.fn
    >

const SCAN_URL = 'perawallet://app/scan/'

describe('usePendingScanRequest', () => {
    let appStateListener: ((state: string) => void) | undefined

    beforeEach(() => {
        handleDeepLink.mockClear()
        consumePendingScan().mockReset().mockResolvedValue(false)
        appStateListener = undefined
        vi.spyOn(AppState, 'addEventListener').mockImplementation(
            (_, listener) => {
                appStateListener = listener as (state: string) => void
                return { remove: vi.fn() } as never
            },
        )
    })

    // The control launches Pera, so the request is waiting when the app starts.
    it('opens the scanner when the control launched the app', async () => {
        consumePendingScan().mockResolvedValueOnce(true)

        renderHook(() => usePendingScanRequest())

        await waitFor(() =>
            expect(handleDeepLink).toHaveBeenCalledWith(
                SCAN_URL,
                false,
                'in-app',
            ),
        )
    })

    it('opens the scanner when the app returns to the foreground with a request', async () => {
        renderHook(() => usePendingScanRequest())
        await waitFor(() => expect(consumePendingScan()).toHaveBeenCalled())
        consumePendingScan().mockResolvedValueOnce(true)

        await act(async () => appStateListener?.('active'))

        await waitFor(() => expect(handleDeepLink).toHaveBeenCalledOnce())
    })

    // iOS may activate the app before the control records the request.
    it('opens the scanner when the control fires while the app is already active', async () => {
        let notify: (() => void) | undefined
        ;(
            getProvider().widgets.onScanRequested as unknown as ReturnType<
                typeof vi.fn
            >
        ).mockImplementation((listener: () => void) => {
            notify = listener
            return vi.fn()
        })
        renderHook(() => usePendingScanRequest())
        await waitFor(() => expect(consumePendingScan()).toHaveBeenCalled())
        consumePendingScan().mockResolvedValueOnce(true)

        await act(async () => notify?.())

        await waitFor(() => expect(handleDeepLink).toHaveBeenCalledOnce())
    })

    it('stops listening for control requests on unmount', () => {
        const unsubscribe = vi.fn()
        ;(
            getProvider().widgets.onScanRequested as unknown as ReturnType<
                typeof vi.fn
            >
        ).mockReturnValue(unsubscribe)
        const { unmount } = renderHook(() => usePendingScanRequest())

        unmount()

        expect(unsubscribe).toHaveBeenCalledOnce()
    })

    it('does nothing without a request', async () => {
        renderHook(() => usePendingScanRequest())

        await act(async () => appStateListener?.('active'))

        expect(handleDeepLink).not.toHaveBeenCalled()
    })

    it('ignores going to the background', async () => {
        renderHook(() => usePendingScanRequest())
        await waitFor(() =>
            expect(consumePendingScan()).toHaveBeenCalledTimes(1),
        )

        await act(async () => appStateListener?.('background'))

        expect(consumePendingScan()).toHaveBeenCalledTimes(1)
    })
})
