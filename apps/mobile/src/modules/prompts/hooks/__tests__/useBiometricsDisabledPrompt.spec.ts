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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const acknowledgeMock = vi.fn()
const enableMock = vi.fn()
const showToastMock = vi.fn()
const biometricsState = {
    disabledReason: null as string | null,
}

vi.mock('@perawallet/wallet-core-security', () => ({
    useBiometrics: () => ({
        disabledReason: biometricsState.disabledReason,
        acknowledgeBiometricsDisabled: acknowledgeMock,
        enableBiometrics: enableMock,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: showToastMock }),
}))

import { useBiometricsDisabledPrompt } from '../useBiometricsDisabledPrompt'

describe('useBiometricsDisabledPrompt', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        biometricsState.disabledReason = 'enrollment-changed'
        enableMock.mockResolvedValue({ ok: true })
    })

    it('is not due while nothing has disabled biometrics', () => {
        biometricsState.disabledReason = null

        const { result } = renderHook(() => useBiometricsDisabledPrompt())

        expect(result.current.isDue).toBe(false)
        expect(result.current.reason).toBeNull()
    })

    it('is due, with the reason, once the app disabled biometrics', () => {
        const { result } = renderHook(() => useBiometricsDisabledPrompt())

        expect(result.current.isDue).toBe(true)
        expect(result.current.reason).toBe('enrollment-changed')
    })

    it('re-enables biometrics with an OS prompt', async () => {
        const { result } = renderHook(() => useBiometricsDisabledPrompt())

        await result.current.enable()

        expect(enableMock).toHaveBeenCalledWith(
            expect.objectContaining({
                title: expect.any(String),
                cancelLabel: expect.any(String),
            }),
        )
        expect(showToastMock).not.toHaveBeenCalled()
    })

    // The reported bug: with biometrics off at the OS level the enable fails
    // before any system prompt appears, so the button looked inert.
    it.each(['unavailable', 'weak-biometric', 'unconfirmed'])(
        'explains a %s failure instead of doing nothing visible',
        async reason => {
            enableMock.mockResolvedValue({ ok: false, reason })

            const { result } = renderHook(() => useBiometricsDisabledPrompt())
            await result.current.enable()

            expect(showToastMock).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'error' }),
            )
        },
    )

    // The fix has to be made outside the app, so the prompt stays up: keeping
    // the reason set is what holds it on screen for the retry.
    it.each(['unavailable', 'weak-biometric', 'unconfirmed'])(
        'keeps the offer open after a %s failure',
        async reason => {
            enableMock.mockResolvedValue({ ok: false, reason })

            const { result } = renderHook(() => useBiometricsDisabledPrompt())
            await result.current.enable()

            expect(acknowledgeMock).not.toHaveBeenCalled()
        },
    )

    // Nothing to acknowledge on success — enableBiometrics clears the reason
    // itself, which is what takes the prompt off screen.
    it('leaves the reason to enableBiometrics on success', async () => {
        const { result } = renderHook(() => useBiometricsDisabledPrompt())

        await result.current.enable()

        expect(acknowledgeMock).not.toHaveBeenCalled()
    })

    // The user saw the prompt and cancelled it — nothing to explain.
    it('stays quiet when the user declines the OS prompt', async () => {
        enableMock.mockResolvedValue({ ok: false, reason: 'declined' })

        const { result } = renderHook(() => useBiometricsDisabledPrompt())
        await result.current.enable()

        expect(showToastMock).not.toHaveBeenCalled()
    })

    // A declined OS prompt is still an answer: the offer is spent before the
    // prompt fires, so it cannot return on the next unlock.
    it('spends the offer even when enabling fails', async () => {
        enableMock.mockResolvedValue({ ok: false, reason: 'declined' })

        const { result } = renderHook(() => useBiometricsDisabledPrompt())
        await result.current.enable()

        expect(acknowledgeMock).toHaveBeenCalled()
    })

    it('acknowledges without enabling when the offer is declined', () => {
        const { result } = renderHook(() => useBiometricsDisabledPrompt())

        result.current.acknowledge()

        expect(acknowledgeMock).toHaveBeenCalled()
        expect(enableMock).not.toHaveBeenCalled()
    })
})
