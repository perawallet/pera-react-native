/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// surface values the real module uses
type Surface = 'popup' | 'expanded' | 'approval'

const mocks = vi.hoisted(() => ({
    surface: 'popup' as Surface,
    isInitialized: null as boolean | null,
    isUnlocked: null as boolean | null,
    showOnboarding: false,
    hydrateKeystore: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    armAutoLock: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}))

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    getSurface: (): Surface => mocks.surface,
}))

vi.mock('@modules/vault', () => ({
    useVaultLockState: () => ({
        isInitialized: mocks.isInitialized,
        isUnlocked: mocks.isUnlocked,
    }),
}))

vi.mock('@hooks/useShowOnboarding', () => ({
    useShowOnboarding: () => mocks.showOnboarding,
}))

vi.mock('@perawallet/wallet-extension-provider', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-extension-provider')
        >()
    return {
        ...original,
        hydrateKeystore: () => mocks.hydrateKeystore(),
    }
})

vi.mock(
    '@perawallet/wallet-extension-keystore-chrome',
    async importOriginal => {
        const original =
            await importOriginal<
                typeof import('@perawallet/wallet-extension-keystore-chrome')
            >()
        return {
            ...original,
            armAutoLock: () => mocks.armAutoLock(),
        }
    },
)

import { useWebAppShell } from '../useWebAppShell'

describe('useWebAppShell', () => {
    beforeEach(() => {
        mocks.surface = 'popup'
        mocks.isInitialized = null
        mocks.isUnlocked = null
        mocks.showOnboarding = false
        vi.clearAllMocks()
    })

    it('returns approval-placeholder when surface is approval, regardless of vault state', () => {
        mocks.surface = 'approval'
        mocks.isInitialized = null
        mocks.isUnlocked = null

        const { result } = renderHook(() => useWebAppShell())
        expect(result.current.shellState).toBe('approval-placeholder')
    })

    it('returns resolving when vault state is still null', () => {
        mocks.surface = 'popup'
        mocks.isInitialized = null
        mocks.isUnlocked = null

        const { result } = renderHook(() => useWebAppShell())
        expect(result.current.shellState).toBe('resolving')
    })

    it('returns create-password when vault is not initialized', () => {
        mocks.surface = 'popup'
        mocks.isInitialized = false
        mocks.isUnlocked = false

        const { result } = renderHook(() => useWebAppShell())
        expect(result.current.shellState).toBe('create-password')
    })

    it('returns onboarding when initialized+unlocked and showOnboarding is true, after hydrateKeystore resolves', async () => {
        mocks.surface = 'popup'
        mocks.isInitialized = true
        mocks.isUnlocked = true
        mocks.showOnboarding = true

        const { result } = renderHook(() => useWebAppShell())

        // Initially resolving while keystore hydrates
        expect(result.current.shellState).toBe('resolving')

        await waitFor(() =>
            expect(result.current.shellState).toBe('onboarding'),
        )

        expect(mocks.hydrateKeystore).toHaveBeenCalledOnce()
    })

    it('returns main when initialized+unlocked and showOnboarding is false, after hydrateKeystore resolves', async () => {
        mocks.surface = 'popup'
        mocks.isInitialized = true
        mocks.isUnlocked = true
        mocks.showOnboarding = false

        const { result } = renderHook(() => useWebAppShell())

        expect(result.current.shellState).toBe('resolving')

        await waitFor(() => expect(result.current.shellState).toBe('main'))

        expect(mocks.hydrateKeystore).toHaveBeenCalledOnce()
    })

    it('calls hydrateKeystore only once per unlock transition, not on every render', async () => {
        mocks.surface = 'popup'
        mocks.isInitialized = true
        mocks.isUnlocked = true
        mocks.showOnboarding = false

        const { result, rerender } = renderHook(() => useWebAppShell())

        await waitFor(() => expect(result.current.shellState).toBe('main'))

        // Force re-renders
        act(() => {
            rerender()
            rerender()
            rerender()
        })

        expect(mocks.hydrateKeystore).toHaveBeenCalledOnce()
    })

    it('re-arms auto-lock on every unlock but hydrates the keystore once', async () => {
        mocks.surface = 'popup'
        mocks.isInitialized = true
        mocks.isUnlocked = true
        mocks.showOnboarding = false

        const { result, rerender } = renderHook(() => useWebAppShell())

        // Wait for initial unlock to settle
        await waitFor(() => expect(result.current.shellState).toBe('main'))

        // First unlock: both hydrate and arm
        expect(mocks.hydrateKeystore).toHaveBeenCalledOnce()
        expect(mocks.armAutoLock).toHaveBeenCalledOnce()

        // Lock: transition isUnlocked to false
        mocks.isUnlocked = false
        act(() => {
            rerender()
        })

        // Unlock again: re-arm but do NOT re-hydrate
        mocks.isUnlocked = true
        act(() => {
            rerender()
        })

        await waitFor(() => expect(mocks.armAutoLock).toHaveBeenCalledTimes(2))

        expect(mocks.hydrateKeystore).toHaveBeenCalledOnce()
    })
})
