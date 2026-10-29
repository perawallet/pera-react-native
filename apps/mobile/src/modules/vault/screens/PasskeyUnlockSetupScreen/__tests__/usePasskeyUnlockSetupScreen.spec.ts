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
    status: 'idle' as const,
    enableWithSession: vi.fn<() => Promise<void>>(),
    recordSkip: vi.fn(),
    clearPending: vi.fn<() => Promise<void>>(),
    setPreference: vi.fn(),
    hasHydrated: true,
    finishHydration: () => {},
    isPasskeyUnlockEnabled: vi.fn<() => Promise<boolean>>(),
}))

vi.mock('@perawallet/wallet-extension-keystore-chrome', () => ({
    isPasskeyUnlockEnabled: mocks.isPasskeyUnlockEnabled,
}))

vi.mock(
    '../../../components/PasskeyUnlockSetup/usePasskeyUnlockSetup.web',
    () => ({
        usePasskeyUnlockSetup: () => ({
            status: mocks.status,
            enableWithSession: mocks.enableWithSession,
            enableWithPassword: vi.fn(),
            recordSkip: mocks.recordSkip,
        }),
    }),
)
vi.mock('../../../hooks/usePasskeySetupStore.web', () => ({
    usePasskeySetupStore: (
        selector: (state: {
            clearPending: typeof mocks.clearPending
        }) => unknown,
    ) => selector({ clearPending: mocks.clearPending }),
}))
vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: () => ({
        setPreference: mocks.setPreference,
        getPreference: vi.fn(),
    }),
    useSettingsStore: {
        persist: {
            hasHydrated: () => mocks.hasHydrated,
            onFinishHydration: (callback: () => void) => {
                mocks.finishHydration = callback
                return () => {}
            },
        },
    },
}))

import { usePasskeyUnlockSetupScreen } from '../usePasskeyUnlockSetupScreen.web'

describe('usePasskeyUnlockSetupScreen', () => {
    beforeEach(() => {
        mocks.hasHydrated = true
        mocks.enableWithSession.mockResolvedValue(undefined)
        mocks.clearPending.mockResolvedValue(undefined)
        mocks.setPreference.mockReset()
        mocks.isPasskeyUnlockEnabled.mockResolvedValue(false)
    })

    it('skips the step when passkey unlock is already enabled', async () => {
        mocks.isPasskeyUnlockEnabled.mockResolvedValue(true)
        const onDone = vi.fn()

        renderHook(() => usePasskeyUnlockSetupScreen({ onDone }))
        await act(async () => {})

        expect(mocks.clearPending).toHaveBeenCalledTimes(1)
        expect(onDone).toHaveBeenCalledTimes(1)
    })

    it('stays on the step when the enabled probe fails', async () => {
        mocks.isPasskeyUnlockEnabled.mockRejectedValue(new Error('storage'))
        const onDone = vi.fn()

        renderHook(() => usePasskeyUnlockSetupScreen({ onDone }))
        await act(async () => {})

        expect(mocks.clearPending).not.toHaveBeenCalled()
        expect(onDone).not.toHaveBeenCalled()
    })

    it('stays on the step while passkey unlock is not enabled', async () => {
        const onDone = vi.fn()

        renderHook(() => usePasskeyUnlockSetupScreen({ onDone }))
        await act(async () => {})

        expect(mocks.clearPending).not.toHaveBeenCalled()
        expect(onDone).not.toHaveBeenCalled()
    })

    it('handleEnable runs the session ceremony', async () => {
        const { result } = renderHook(() =>
            usePasskeyUnlockSetupScreen({ onDone: vi.fn() }),
        )

        await act(() => result.current.handleEnable())

        expect(mocks.enableWithSession).toHaveBeenCalledTimes(1)
    })

    it('handleContinue clears the pending step, then calls onDone', async () => {
        const order: string[] = []
        mocks.clearPending.mockImplementation(async () => {
            order.push('clearPending')
        })
        const onDone = vi.fn(() => order.push('onDone'))
        const { result } = renderHook(() =>
            usePasskeyUnlockSetupScreen({ onDone }),
        )

        await act(() => result.current.handleContinue())

        expect(order).toEqual(['clearPending', 'onDone'])
    })

    it('handleNotNow records the skip, spends the one-time offer, clears the step and calls onDone', async () => {
        const order: string[] = []
        mocks.setPreference.mockImplementation(() => {
            order.push('setPreference')
        })
        mocks.clearPending.mockImplementation(async () => {
            order.push('clearPending')
        })
        const onDone = vi.fn()
        const { result } = renderHook(() =>
            usePasskeyUnlockSetupScreen({ onDone }),
        )

        await act(() => result.current.handleNotNow())

        expect(mocks.recordSkip).toHaveBeenCalledTimes(1)
        expect(mocks.setPreference).toHaveBeenCalledWith(
            'passkey_unlock_offer_prompt',
            true,
        )
        expect(onDone).toHaveBeenCalledTimes(1)
        expect(order).toEqual(['setPreference', 'clearPending'])
    })

    it('handleNotNow waits for the settings store to hydrate before writing the preference', async () => {
        mocks.hasHydrated = false
        const { result } = renderHook(() =>
            usePasskeyUnlockSetupScreen({ onDone: vi.fn() }),
        )

        let notNow: Promise<void> = Promise.resolve()
        act(() => {
            notNow = result.current.handleNotNow()
        })
        await act(async () => {
            await Promise.resolve()
        })
        expect(mocks.setPreference).not.toHaveBeenCalled()

        act(() => mocks.finishHydration())
        await act(() => notNow)

        expect(mocks.setPreference).toHaveBeenCalledWith(
            'passkey_unlock_offer_prompt',
            true,
        )
    })
    it('a second tap while the first waits on hydration records one skip and leaves once', async () => {
        mocks.hasHydrated = false
        const onDone = vi.fn()
        const { result } = renderHook(() =>
            usePasskeyUnlockSetupScreen({ onDone }),
        )

        let first: Promise<void> = Promise.resolve()
        let second: Promise<void> = Promise.resolve()
        act(() => {
            first = result.current.handleNotNow()
            second = result.current.handleNotNow()
        })
        act(() => mocks.finishHydration())
        await act(() => Promise.all([first, second]))

        expect(mocks.recordSkip).toHaveBeenCalledTimes(1)
        expect(mocks.clearPending).toHaveBeenCalledTimes(1)
        expect(onDone).toHaveBeenCalledTimes(1)
    })

    it('handleNotNow still leaves the step when saving the skip throws', async () => {
        mocks.setPreference.mockImplementation(() => {
            throw new Error('settings write failed')
        })
        const onDone = vi.fn()
        const { result } = renderHook(() =>
            usePasskeyUnlockSetupScreen({ onDone }),
        )

        await act(() => result.current.handleNotNow())

        expect(mocks.clearPending).toHaveBeenCalledTimes(1)
        expect(onDone).toHaveBeenCalledTimes(1)
    })
})
