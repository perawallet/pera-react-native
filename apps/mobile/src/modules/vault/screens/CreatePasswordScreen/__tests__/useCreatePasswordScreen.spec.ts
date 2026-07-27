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
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    createVault: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-keystore-chrome', () => ({
    createVault: mocks.createVault,
}))

import { useCreatePasswordScreen } from '../useCreatePasswordScreen'

describe('useCreatePasswordScreen', () => {
    const onDone = vi.fn()

    beforeEach(() => {
        mocks.createVault.mockResolvedValue(undefined)
        onDone.mockReset()
    })

    it('validates too-short password', () => {
        const { result } = renderHook(() => useCreatePasswordScreen({ onDone }))
        act(() => result.current.setPassword('short'))
        expect(result.current.validationError).toBe('too_short')
        expect(result.current.canSubmit).toBe(false)
    })

    it('validates password mismatch', () => {
        const { result } = renderHook(() => useCreatePasswordScreen({ onDone }))
        act(() => result.current.setPassword('longpassword'))
        act(() => result.current.setConfirmation('different'))
        expect(result.current.validationError).toBe('mismatch')
        expect(result.current.canSubmit).toBe(false)
    })

    it('allows submit when password is valid and matches confirmation', () => {
        const { result } = renderHook(() => useCreatePasswordScreen({ onDone }))
        act(() => result.current.setPassword('longpassword'))
        act(() => result.current.setConfirmation('longpassword'))
        expect(result.current.validationError).toBeNull()
        expect(result.current.canSubmit).toBe(true)
    })

    it('calls createVault with password then onDone on successful submit', async () => {
        const { result } = renderHook(() => useCreatePasswordScreen({ onDone }))
        act(() => result.current.setPassword('correctpassword'))
        act(() => result.current.setConfirmation('correctpassword'))
        await act(() => result.current.handleSubmit())
        expect(mocks.createVault).toHaveBeenCalledWith('correctpassword')
        expect(onDone).toHaveBeenCalledTimes(1)
    })

    it('isSubmitting resets to false after submit completes', async () => {
        const { result } = renderHook(() => useCreatePasswordScreen({ onDone }))
        act(() => result.current.setPassword('correctpassword'))
        act(() => result.current.setConfirmation('correctpassword'))
        expect(result.current.isSubmitting).toBe(false)
        await act(() => result.current.handleSubmit())
        expect(result.current.isSubmitting).toBe(false)
        expect(onDone).toHaveBeenCalledTimes(1)
    })

    it('sets hasError and does not call onDone when createVault throws', async () => {
        mocks.createVault.mockRejectedValue(new Error('storage failure'))
        const { result } = renderHook(() => useCreatePasswordScreen({ onDone }))
        act(() => result.current.setPassword('correctpassword'))
        act(() => result.current.setConfirmation('correctpassword'))
        await act(() => result.current.handleSubmit())
        expect(result.current.hasError).toBe(true)
        expect(result.current.isSubmitting).toBe(false)
        expect(onDone).not.toHaveBeenCalled()
    })

    it('ignores duplicate submit while isSubmitting is true', async () => {
        let resolveVault!: () => void
        mocks.createVault.mockReturnValue(
            new Promise<void>(resolve => {
                resolveVault = resolve
            }),
        )
        const { result } = renderHook(() => useCreatePasswordScreen({ onDone }))
        act(() => result.current.setPassword('correctpassword'))
        act(() => result.current.setConfirmation('correctpassword'))

        // Start the first submit without awaiting the inner async work so we
        // can observe isSubmitting mid-flight.
        const firstSubmitDone = result.current.handleSubmit()

        // Flush the synchronous setIsSubmitting(true) state update.
        await act(async () => {})

        // canSubmit is now false (isSubmitting=true), so a second call is a no-op.
        await act(() => result.current.handleSubmit())

        // Settle the first submit.
        resolveVault()
        await act(async () => {
            await firstSubmitDone
        })

        expect(mocks.createVault).toHaveBeenCalledTimes(1)
    })
})
