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

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// surface values the real module uses
type Surface = 'popup' | 'expanded' | 'approval'

const mocks = vi.hoisted(() => ({
    surface: 'popup' as Surface,
    isInitialized: null as boolean | null,
    isUnlocked: null as boolean | null,
    showOnboarding: false,
    hasAccounts: false,
    keystoreReady: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    armAutoLock: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    initializeDatabase: vi
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined),
    getDatabase: vi.fn(() => ({ __db: true })),
    seedAlgoAsset: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    initializeSyncService: vi.fn(),
    syncStart: vi.fn(),
    syncStop: vi.fn(),
    syncIsRunning: vi.fn(() => false),
    setOnConfirmedHandler: vi.fn(),
    getCurrentApproval: vi
        .fn<() => Promise<{ requestId: string; kind: string } | null>>()
        .mockResolvedValue(null),
}))

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    getSurface: (): Surface => mocks.surface,
    getCurrentApproval: () => mocks.getCurrentApproval(),
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

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...original,
        useHasAccounts: () => mocks.hasAccounts,
    }
})

vi.mock('@perawallet/wallet-extension-provider', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-extension-provider')
        >()
    return {
        ...original,
        getKeystore: () => ({ ready: mocks.keystoreReady() }),
        getProvider: () => ({ database: {} }),
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

vi.mock('@perawallet/wallet-core-database', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-database')
        >()
    return {
        ...original,
        initializeDatabase: (...args: unknown[]) =>
            mocks.initializeDatabase(...(args as [])),
        getDatabase: () => mocks.getDatabase(),
    }
})

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...original,
        seedAlgoAsset: (...args: unknown[]) =>
            mocks.seedAlgoAsset(...(args as [])),
    }
})

vi.mock('@perawallet/wallet-core-background', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-background')
        >()
    return {
        ...original,
        initializeSyncService: (...args: unknown[]) =>
            mocks.initializeSyncService(...args),
        getSyncService: () => ({
            start: mocks.syncStart,
            stop: mocks.syncStop,
            isRunning: mocks.syncIsRunning,
        }),
    }
})

vi.mock('@perawallet/wallet-core-signing', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-signing')>()
    return {
        ...original,
        // Identity matters here: the hook passes this reference through to
        // initializeSyncService verbatim, so the mock must be the exact
        // same function object rather than a wrapper.
        setOnConfirmedHandler: mocks.setOnConfirmedHandler,
    }
})

import { useWebAppShell } from '../useWebAppShell'

describe('useWebAppShell', () => {
    beforeEach(() => {
        mocks.surface = 'popup'
        mocks.isInitialized = null
        mocks.isUnlocked = null
        mocks.showOnboarding = false
        mocks.hasAccounts = false
        vi.clearAllMocks()
        mocks.initializeDatabase.mockResolvedValue(undefined)
        mocks.seedAlgoAsset.mockResolvedValue(undefined)
        mocks.keystoreReady.mockResolvedValue(undefined)
        mocks.armAutoLock.mockResolvedValue(undefined)
        mocks.getCurrentApproval.mockResolvedValue(null)
    })

    it('returns approval-placeholder when surface is approval, regardless of vault state', () => {
        mocks.surface = 'approval'
        mocks.isInitialized = null
        mocks.isUnlocked = null

        const { result } = renderHook(() => useWebAppShell())
        expect(result.current.shellState).toBe('approval-placeholder')
    })

    it('routes popup surface to dapp-request when a pending enable is discovered', async () => {
        mocks.surface = 'popup'
        mocks.isInitialized = null
        mocks.isUnlocked = null
        mocks.getCurrentApproval.mockResolvedValue({
            requestId: 'r1',
            kind: 'enable',
        })

        const { result } = renderHook(() => useWebAppShell())

        expect(result.current.shellState).toBe('resolving')

        await waitFor(() =>
            expect(result.current.shellState).toBe('dapp-request'),
        )
    })

    it('falls through to the normal wallet flow when the popup has no pending enable', async () => {
        mocks.surface = 'popup'
        mocks.isInitialized = true
        mocks.isUnlocked = true
        mocks.showOnboarding = false
        mocks.getCurrentApproval.mockResolvedValue(null)

        const { result } = renderHook(() => useWebAppShell())

        await waitFor(() =>
            expect(mocks.getCurrentApproval).toHaveBeenCalledOnce(),
        )

        expect(result.current.shellState).not.toBe('dapp-request')
        await waitFor(() => expect(result.current.shellState).toBe('main'))
    })

    it('returns resolving when vault state is still null', () => {
        mocks.surface = 'popup'
        mocks.isInitialized = null
        mocks.isUnlocked = null

        const { result } = renderHook(() => useWebAppShell())
        expect(result.current.shellState).toBe('resolving')
    })

    it('returns create-password when vault is not initialized', async () => {
        mocks.surface = 'popup'
        mocks.isInitialized = false
        mocks.isUnlocked = false

        const { result } = renderHook(() => useWebAppShell())
        // Popup surface waits on the pending-enable check (resolves to null
        // here) before falling through to vault-state routing.
        await waitFor(() =>
            expect(result.current.shellState).toBe('create-password'),
        )
    })

    it('returns onboarding when initialized+unlocked and showOnboarding is true, after bootstrap resolves', async () => {
        mocks.surface = 'popup'
        mocks.isInitialized = true
        mocks.isUnlocked = true
        mocks.showOnboarding = true

        const { result } = renderHook(() => useWebAppShell())

        // Initially resolving while the bootstrap chain runs
        expect(result.current.shellState).toBe('resolving')

        await waitFor(() =>
            expect(result.current.shellState).toBe('onboarding'),
        )

        expect(mocks.keystoreReady).toHaveBeenCalledOnce()
    })

    it('returns main when initialized+unlocked and showOnboarding is false, after bootstrap resolves', async () => {
        mocks.surface = 'popup'
        mocks.isInitialized = true
        mocks.isUnlocked = true
        mocks.showOnboarding = false

        const { result } = renderHook(() => useWebAppShell())

        expect(result.current.shellState).toBe('resolving')

        // Stays 'resolving' until DB + sync bootstrap resolve, not just keystore.
        await waitFor(() => expect(mocks.keystoreReady).toHaveBeenCalledOnce())
        await waitFor(() =>
            expect(mocks.initializeDatabase).toHaveBeenCalledOnce(),
        )

        await waitFor(() => expect(result.current.shellState).toBe('main'))
    })

    it('calls keystore ready only once per unlock transition, not on every render', async () => {
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

        expect(mocks.keystoreReady).toHaveBeenCalledOnce()
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
        expect(mocks.keystoreReady).toHaveBeenCalledOnce()
        expect(mocks.armAutoLock).toHaveBeenCalledOnce()

        // Lock: transition isUnlocked to false
        mocks.isUnlocked = false
        act(() => {
            rerender()
        })

        // Unlock again: re-arm but do NOT re-hydrate/re-bootstrap
        mocks.isUnlocked = true
        act(() => {
            rerender()
        })

        await waitFor(() => expect(mocks.armAutoLock).toHaveBeenCalledTimes(2))

        expect(mocks.keystoreReady).toHaveBeenCalledOnce()
    })

    it('bootstraps in order: keystore ready before initializeDatabase; seedAlgoAsset receives getDatabase(); initializeSyncService called once with queryClient + registerCompletionHandler', async () => {
        mocks.surface = 'popup'
        mocks.isInitialized = true
        mocks.isUnlocked = true
        mocks.showOnboarding = false

        const callOrder: string[] = []
        mocks.keystoreReady.mockImplementation(async () => {
            callOrder.push('keystoreReady')
        })
        mocks.initializeDatabase.mockImplementation(async () => {
            callOrder.push('initializeDatabase')
        })
        mocks.seedAlgoAsset.mockImplementation(async () => {
            callOrder.push('seedAlgoAsset')
        })

        const { result } = renderHook(() => useWebAppShell())

        await waitFor(() => expect(result.current.shellState).toBe('main'))

        expect(callOrder).toEqual([
            'keystoreReady',
            'initializeDatabase',
            'seedAlgoAsset',
        ])
        expect(mocks.seedAlgoAsset).toHaveBeenCalledWith(
            mocks.getDatabase.mock.results[0]?.value,
        )
        expect(mocks.initializeSyncService).toHaveBeenCalledOnce()
        const initArgs = mocks.initializeSyncService.mock.calls[0]?.[0] as {
            queryClient: unknown
            registerCompletionHandler: unknown
        }
        expect(initArgs.queryClient).toBeDefined()
        expect(initArgs.registerCompletionHandler).toBe(
            mocks.setOnConfirmedHandler,
        )
    })

    it('starts sync when hasAccounts && unlocked, stops on lock, never starts with no accounts', async () => {
        mocks.surface = 'popup'
        mocks.isInitialized = true
        mocks.isUnlocked = true
        mocks.showOnboarding = false
        mocks.hasAccounts = false

        const { result, rerender } = renderHook(() => useWebAppShell())
        await waitFor(() => expect(result.current.shellState).toBe('main'))

        // No accounts yet: sync never starts.
        expect(mocks.syncStart).not.toHaveBeenCalled()

        // Accounts appear: sync starts.
        mocks.hasAccounts = true
        act(() => {
            rerender()
        })
        await waitFor(() => expect(mocks.syncStart).toHaveBeenCalledOnce())

        // Lock: sync stops.
        mocks.isUnlocked = false
        act(() => {
            rerender()
        })
        await waitFor(() => expect(mocks.syncStop).toHaveBeenCalledOnce())
    })

    it('sets shellState to error when initializeDatabase rejects (fail loud, not silent main)', async () => {
        mocks.surface = 'popup'
        mocks.isInitialized = true
        mocks.isUnlocked = true
        mocks.showOnboarding = false
        mocks.initializeDatabase.mockRejectedValue(new Error('db init failed'))

        const { result } = renderHook(() => useWebAppShell())

        await waitFor(() => expect(result.current.shellState).toBe('error'))
    })
})
