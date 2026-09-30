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

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCameraAccessScreen } from '../useCameraAccessScreen.web'

const { closeCurrentTabMock } = vi.hoisted(() => ({
    closeCurrentTabMock: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-browser-runtime', () => ({
    closeCurrentTab: closeCurrentTabMock,
}))

const getUserMedia = vi.fn()
const stopTrack = vi.fn()
const originalMediaDevices = navigator.mediaDevices

beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia },
    })
})

afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: originalMediaDevices,
    })
})

describe('useCameraAccessScreen (web)', () => {
    test('reports granted and releases the camera once the prompt is accepted', async () => {
        getUserMedia.mockResolvedValue({
            getTracks: () => [{ stop: stopTrack }],
        })

        const { result } = renderHook(() => useCameraAccessScreen())

        expect(result.current.state).toBe('requesting')
        await waitFor(() => expect(result.current.state).toBe('granted'))
        expect(stopTrack).toHaveBeenCalledTimes(1)
    })

    test('reports denied when the browser refuses the camera', async () => {
        getUserMedia.mockRejectedValue(new DOMException('', 'NotAllowedError'))

        const { result } = renderHook(() => useCameraAccessScreen())

        await waitFor(() => expect(result.current.state).toBe('denied'))
    })

    test('closes its own tab', () => {
        getUserMedia.mockReturnValue(new Promise(() => {}))
        const { result } = renderHook(() => useCameraAccessScreen())

        result.current.handleClose()

        expect(closeCurrentTabMock).toHaveBeenCalledTimes(1)
    })
})
