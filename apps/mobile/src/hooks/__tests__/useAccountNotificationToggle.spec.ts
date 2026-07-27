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

import { renderHook } from '@test-utils/render'
import { act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { onlineManager } from '@tanstack/react-query'
import { NoConnectionError } from '@perawallet/wallet-core-shared'

const mocks = vi.hoisted(() => ({
    setAccountEnabled: vi.fn(),
    mutateAsync: vi.fn(),
    showToast: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-messages', () => ({
    useNotificationPreferences: () => ({
        setAccountEnabled: mocks.setAccountEnabled,
        isAccountEnabled: vi.fn(() => true),
        disabledAccounts: [],
    }),
    useAccountNotificationEnabledMutation: () => ({
        mutateAsync: mocks.mutateAsync,
    }),
}))

// Only useToast is mocked: the real useErrorToast runs, so these tests prove
// the offline copy end to end rather than trusting a mocked dispatcher.
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mocks.showToast,
        errorToast: vi.fn(),
        infoToast: vi.fn(),
        successToast: vi.fn(),
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { useAccountNotificationToggle } from '../useAccountNotificationToggle'

describe('useAccountNotificationToggle', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.mutateAsync.mockResolvedValue({})
    })

    afterEach(() => onlineManager.setOnline(true))

    it('applies the optimistic write and PATCHes the backend on success', async () => {
        const { result } = renderHook(() => useAccountNotificationToggle())

        let outcome: boolean | undefined
        await act(async () => {
            outcome = await result.current.toggleAccountNotification(
                'ADDR1',
                true,
            )
        })

        expect(outcome).toBe(true)
        expect(mocks.setAccountEnabled).toHaveBeenCalledTimes(1)
        expect(mocks.setAccountEnabled).toHaveBeenCalledWith('ADDR1', true)
        expect(mocks.mutateAsync).toHaveBeenCalledWith({
            accountID: 'ADDR1',
            status: true,
        })
        expect(mocks.showToast).not.toHaveBeenCalled()
    })

    it('rolls back and resolves false when the backend rejects', async () => {
        mocks.mutateAsync.mockRejectedValue(new Error('boom'))

        const { result } = renderHook(() => useAccountNotificationToggle())

        let outcome: boolean | undefined
        await act(async () => {
            outcome = await result.current.toggleAccountNotification(
                'ADDR1',
                true,
            )
        })

        expect(outcome).toBe(false)
        expect(mocks.setAccountEnabled).toHaveBeenNthCalledWith(
            1,
            'ADDR1',
            true,
        )
        expect(mocks.setAccountEnabled).toHaveBeenNthCalledWith(
            2,
            'ADDR1',
            false,
        )
        expect(mocks.showToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
            undefined,
        )
    })

    // AC #2: the persisted store must end up matching what the backend was
    // last told, so a restart cannot resurrect an optimistic value the
    // backend never received.
    it('leaves the store at its pre-toggle value after a failed mutation', async () => {
        let stored = false
        mocks.setAccountEnabled.mockImplementation(
            (_address: string, enabled: boolean) => {
                stored = enabled
            },
        )
        mocks.mutateAsync.mockRejectedValue(new Error('boom'))

        const { result } = renderHook(() => useAccountNotificationToggle())

        await act(async () => {
            await result.current.toggleAccountNotification('ADDR1', true)
        })

        expect(stored).toBe(false)
    })

    // Fire-and-fail regime: networkMode 'always' means the mutationFn runs
    // and rejects offline instead of pausing.
    it('shows the localized offline copy when the failure is connectivity', async () => {
        onlineManager.setOnline(false)
        mocks.mutateAsync.mockRejectedValue(new NoConnectionError())

        const { result } = renderHook(() => useAccountNotificationToggle())

        await act(async () => {
            await result.current.toggleAccountNotification('ADDR1', true)
        })

        expect(mocks.mutateAsync).toHaveBeenCalledTimes(1)
        expect(mocks.showToast).toHaveBeenCalledWith(
            {
                title: 'errors.network.no_connection.title',
                body: 'errors.network.no_connection.body',
                type: 'error',
            },
            undefined,
        )
    })

    it('shows generic copy when the failure is not connectivity', async () => {
        mocks.mutateAsync.mockRejectedValue(new Error('boom'))

        const { result } = renderHook(() => useAccountNotificationToggle())

        await act(async () => {
            await result.current.toggleAccountNotification('ADDR1', true)
        })

        expect(mocks.showToast).toHaveBeenCalledWith(
            expect.objectContaining({
                title: expect.not.stringContaining('no_connection'),
            }),
            undefined,
        )
    })
})
