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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const { goBackMock, requirePinMock } = vi.hoisted(() => ({
    goBackMock: vi.fn(),
    requirePinMock: vi.fn(),
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ goBack: goBackMock }),
}))

vi.mock('../useRequirePinVerification', () => ({
    useRequirePinVerification: () => ({
        requirePinVerification: requirePinMock,
    }),
}))

import { usePinGatedScreen } from '../usePinGatedScreen'

describe('usePinGatedScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('stays closed until the PIN is verified, then opens', async () => {
        let resolvePin: (isVerified: boolean) => void = () => {}
        requirePinMock.mockReturnValue(
            new Promise<boolean>(resolve => {
                resolvePin = resolve
            }),
        )

        const { result } = renderHook(() => usePinGatedScreen())

        expect(result.current).toBe(false)

        await act(async () => resolvePin(true))

        expect(result.current).toBe(true)
        expect(goBackMock).not.toHaveBeenCalled()
    })

    it('goes back and stays closed when the PIN is declined', async () => {
        requirePinMock.mockResolvedValue(false)

        const { result } = renderHook(() => usePinGatedScreen())

        await waitFor(() => expect(goBackMock).toHaveBeenCalledTimes(1))
        expect(result.current).toBe(false)
    })

    it('does nothing when the screen unmounts before the prompt answers', async () => {
        let resolvePin: (isVerified: boolean) => void = () => {}
        requirePinMock.mockReturnValue(
            new Promise<boolean>(resolve => {
                resolvePin = resolve
            }),
        )

        const { unmount } = renderHook(() => usePinGatedScreen())
        unmount()

        await act(async () => resolvePin(false))

        expect(goBackMock).not.toHaveBeenCalled()
    })
})
