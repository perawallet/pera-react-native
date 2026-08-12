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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAutoLockListener } from '../useAutoLockListener'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import { usePinCode } from '@perawallet/wallet-core-security'
import {
    clearAccountsStore,
    useDeleteAllData,
} from '@modules/settings/hooks/useDeleteAllData'
import { AppState, type AppStateStatus } from 'react-native'
import type { Maybe, Nullable } from '@perawallet/wallet-core-shared'

const securityStoreState = vi.hoisted(() => ({
    lockRequestVersion: 0,
    setAppLockActive: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: vi.fn(),
    useSecurityStore: (
        selector: (state: {
            lockRequestVersion: number
            setAppLockActive: (active: boolean) => void
        }) => unknown,
    ) => selector(securityStoreState),
}))

vi.mock('@modules/settings/hooks/useDeleteAllData', () => ({
    useDeleteAllData: vi.fn(),
    clearAccountsStore: vi.fn(),
}))

const platformState = vi.hoisted(() => ({ OS: 'android' as 'android' | 'ios' }))
const appStateState = vi.hoisted(() => ({
    currentState: 'active' as string,
    addEventListener: vi.fn(() => ({
        remove: vi.fn(),
    })),
}))

vi.mock('react-native', () => ({
    AppState: appStateState,
    Platform: platformState,
}))

describe('useAutoLockListener', () => {
    const mockCheckAutoLock = vi.fn()
    const mockSetAutoLockStartedAt = vi.fn()
    const mockCheckPinEnabled = vi.fn()
    const mockDeleteAllData = vi.fn()
    let appStateChangeHandler: Nullable<
        (nextAppState: AppStateStatus) => void
    > = null

    beforeEach(() => {
        vi.clearAllMocks()
        platformState.OS = 'android'
        appStateState.currentState = 'active'
        appStateChangeHandler = null
        securityStoreState.lockRequestVersion = 0
        useBottomSheetStore.setState({ isPresentationHeld: false })
        mockCheckPinEnabled.mockResolvedValue(false)
        mockCheckAutoLock.mockResolvedValue(false)
        ;(usePinCode as Mock).mockReturnValue({
            checkAutoLock: mockCheckAutoLock,
            setAutoLockStartedAt: mockSetAutoLockStartedAt,
            checkPinEnabled: mockCheckPinEnabled,
        })
        ;(useDeleteAllData as Mock).mockReturnValue({
            deleteAllData: mockDeleteAllData,
        })
        ;(AppState.addEventListener as Mock).mockImplementation(
            (_event, handler: (nextAppState: AppStateStatus) => void) => {
                appStateChangeHandler = handler
                return { remove: vi.fn() }
            },
        )
    })

    const getAppStateChangeHandler = () =>
        (AppState.addEventListener as Mock).mock.calls.at(-1)?.[1] as (
            nextState: Maybe<string>,
        ) => void

    it('should return initial state', () => {
        const { result } = renderHook(() => useAutoLockListener())

        expect(result.current.isLocked).toBe(false)
        expect(result.current.isChecking).toBe(true)
        expect(typeof result.current.unlock).toBe('function')
        expect(typeof result.current.handleResetData).toBe('function')
    })

    it('should check PIN enabled on mount', async () => {
        renderHook(() => useAutoLockListener())

        await waitFor(() => {
            expect(mockCheckPinEnabled).toHaveBeenCalled()
        })
    })

    describe('mirroring the guard overlay into the security store', () => {
        const lastMirroredValue = () =>
            securityStoreState.setAppLockActive.mock.calls.at(-1)?.[0]

        it('reports active while checking, inactive once init resolves unlocked', async () => {
            const { result } = renderHook(() => useAutoLockListener())

            expect(lastMirroredValue()).toBe(true)

            await waitFor(() => {
                expect(result.current.isChecking).toBe(false)
            })
            expect(lastMirroredValue()).toBe(false)
        })

        it('reports active while locked, inactive after unlock', async () => {
            mockCheckPinEnabled.mockResolvedValue(true)

            const { result } = renderHook(() => useAutoLockListener())

            await waitFor(() => {
                expect(result.current.isLocked).toBe(true)
            })
            expect(lastMirroredValue()).toBe(true)

            act(() => {
                result.current.unlock()
            })
            expect(lastMirroredValue()).toBe(false)
        })

        it('resets to inactive on unmount so signing never wedges', async () => {
            mockCheckPinEnabled.mockResolvedValue(true)

            const { result, unmount } = renderHook(() => useAutoLockListener())
            await waitFor(() => {
                expect(result.current.isLocked).toBe(true)
            })

            unmount()

            expect(lastMirroredValue()).toBe(false)
        })
    })

    // The bottom-sheet hold is what actually keeps sheets from painting under
    // the lock overlay (PERA-4743) — BottomSheetManager reads it directly, so
    // the guard must mirror its overlay state there too.
    describe('mirroring the guard overlay into the bottom-sheet hold', () => {
        const heldValue = () =>
            useBottomSheetStore.getState().isPresentationHeld

        it('holds while checking, releases once init resolves unlocked', async () => {
            const { result } = renderHook(() => useAutoLockListener())

            expect(heldValue()).toBe(true)

            await waitFor(() => {
                expect(result.current.isChecking).toBe(false)
            })
            expect(heldValue()).toBe(false)
        })

        it('holds while locked, releases after unlock', async () => {
            mockCheckPinEnabled.mockResolvedValue(true)

            const { result } = renderHook(() => useAutoLockListener())

            await waitFor(() => {
                expect(result.current.isLocked).toBe(true)
            })
            expect(heldValue()).toBe(true)

            act(() => {
                result.current.unlock()
            })
            expect(heldValue()).toBe(false)
        })

        it('releases the hold on unmount so sheets never wedge', async () => {
            mockCheckPinEnabled.mockResolvedValue(true)

            const { result, unmount } = renderHook(() => useAutoLockListener())
            await waitFor(() => {
                expect(result.current.isLocked).toBe(true)
            })
            expect(heldValue()).toBe(true)

            unmount()

            expect(heldValue()).toBe(false)
        })
    })

    it('should stop checking when checkPinEnabled fails', async () => {
        mockCheckPinEnabled.mockRejectedValue(new Error('Secure storage error'))

        const { result } = renderHook(() => useAutoLockListener())

        await waitFor(() => {
            expect(result.current.isChecking).toBe(false)
        })

        expect(result.current.isLocked).toBe(false)
    })

    it('should set isLocked to true when PIN is enabled on initialization', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)

        const { result } = renderHook(() => useAutoLockListener())

        await waitFor(() => {
            expect(result.current.isLocked).toBe(true)
        })
    })

    it('should set isLocked to false when PIN is disabled on initialization', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)

        const { result } = renderHook(() => useAutoLockListener())

        await waitFor(() => {
            expect(result.current.isLocked).toBe(false)
            expect(result.current.isChecking).toBe(false)
        })
    })

    it('should not crash when initial PIN check fails', async () => {
        mockCheckPinEnabled.mockRejectedValueOnce(
            new Error('checkPinEnabled failed'),
        )

        const { result } = renderHook(() => useAutoLockListener())

        await waitFor(() => {
            expect(result.current.isChecking).toBe(false)
        })

        expect(result.current.isLocked).toBe(false)
    })

    it('should unlock and reset state when unlock is called', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)

        const { result } = renderHook(() => useAutoLockListener())

        await waitFor(() => {
            expect(result.current.isLocked).toBe(true)
        })

        act(() => {
            result.current.unlock()
        })

        expect(result.current.isLocked).toBe(false)
        expect(result.current.isChecking).toBe(false)
        expect(mockSetAutoLockStartedAt).toHaveBeenCalledWith(null)
    })

    it('should delete all data and reset state when handleResetData is called', async () => {
        mockDeleteAllData.mockResolvedValue(undefined)
        mockCheckPinEnabled.mockResolvedValue(true)

        const { result } = renderHook(() => useAutoLockListener())

        await waitFor(() => {
            expect(result.current.isLocked).toBe(true)
        })

        await act(async () => {
            await result.current.handleResetData()
        })

        expect(mockDeleteAllData).toHaveBeenCalled()
        expect(clearAccountsStore).toHaveBeenCalled()
        expect(result.current.isLocked).toBe(false)
        expect(result.current.isChecking).toBe(false)
        expect(mockSetAutoLockStartedAt).toHaveBeenCalledWith(null)
    })

    it('should register AppState listener on mount', () => {
        renderHook(() => useAutoLockListener())

        expect(AppState.addEventListener).toHaveBeenCalledWith(
            'change',
            expect.any(Function),
        )
    })

    it('should not unlock an already-locked app when foreground check returns false (PERA-4196 cancel-FaceID race)', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        mockCheckAutoLock.mockResolvedValue(false)

        const { result } = renderHook(() => useAutoLockListener())

        await waitFor(() => {
            expect(result.current.isLocked).toBe(true)
            expect(result.current.isChecking).toBe(false)
        })

        // Simulate the iOS biometric prompt round-trip: the prompt makes the
        // app go through inactive/background and back to active before the
        // user has authenticated. checkAutoLock will return false because no
        // real time has elapsed — but the app must remain locked.
        act(() => {
            appStateChangeHandler?.('background')
            appStateChangeHandler?.('active')
        })

        await waitFor(() => {
            expect(mockCheckAutoLock).toHaveBeenCalledTimes(1)
        })

        expect(result.current.isLocked).toBe(true)
    })

    it('should keep lock state and stop checking when foreground check fails', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        mockCheckAutoLock.mockRejectedValue(new Error('Auto lock check failed'))

        const { result } = renderHook(() => useAutoLockListener())

        await waitFor(() => {
            expect(result.current.isLocked).toBe(true)
            expect(result.current.isChecking).toBe(false)
        })

        act(() => {
            appStateChangeHandler?.('background')
            appStateChangeHandler?.('active')
        })

        await waitFor(() => {
            expect(result.current.isChecking).toBe(false)
        })

        expect(result.current.isLocked).toBe(true)
        expect(mockCheckAutoLock).toHaveBeenCalledTimes(1)
    })

    it('should ignore inactive to active transition noise on Android', async () => {
        const { result } = renderHook(() => useAutoLockListener())

        await waitFor(() => {
            expect(result.current.isChecking).toBe(false)
        })

        act(() => {
            appStateChangeHandler?.('inactive')
            appStateChangeHandler?.('active')
        })

        expect(mockCheckAutoLock).not.toHaveBeenCalled()

        act(() => {
            appStateChangeHandler?.('background')
            appStateChangeHandler?.('active')
        })

        await waitFor(() => {
            expect(mockCheckAutoLock).toHaveBeenCalledTimes(1)
        })
    })

    it('coalesces a foreground check that arrives mid-check into one non-overlapping re-run', async () => {
        const resolvers: Array<(value: boolean) => void> = []
        mockCheckAutoLock.mockImplementation(
            () =>
                new Promise<boolean>(resolve => {
                    resolvers.push(resolve)
                }),
        )

        const { result } = renderHook(() => useAutoLockListener())

        await waitFor(() => {
            expect(result.current.isChecking).toBe(false)
        })

        act(() => {
            appStateChangeHandler?.('background')
            appStateChangeHandler?.('active')
            appStateChangeHandler?.('background')
            appStateChangeHandler?.('active')
        })

        // The second transition arrives while the first check is still
        // pending — it must be coalesced into a pending re-run, not dropped
        // and not run concurrently with the first.
        expect(mockCheckAutoLock).toHaveBeenCalledTimes(1)

        act(() => {
            resolvers[0]?.(false)
        })

        // The coalesced re-run only starts once the first check settles.
        await waitFor(() => {
            expect(mockCheckAutoLock).toHaveBeenCalledTimes(2)
        })
        expect(result.current.isChecking).toBe(true)

        act(() => {
            resolvers[1]?.(false)
        })

        await waitFor(() => {
            expect(result.current.isChecking).toBe(false)
        })
    })

    it('should remove AppState listener on unmount', () => {
        const mockRemove = vi.fn()
        ;(AppState.addEventListener as Mock).mockReturnValue({
            remove: mockRemove,
        })

        const { unmount } = renderHook(() => useAutoLockListener())

        unmount()

        expect(mockRemove).toHaveBeenCalled()
    })

    it('should not crash when foreground auto-lock check fails', async () => {
        mockCheckAutoLock.mockRejectedValueOnce(
            new Error('checkAutoLock failed'),
        )
        const { result } = renderHook(() => useAutoLockListener())

        await waitFor(() => {
            expect(result.current.isChecking).toBe(false)
        })

        const handleAppStateChange = getAppStateChangeHandler()

        act(() => {
            handleAppStateChange('background')
            handleAppStateChange('active')
        })

        await waitFor(() => {
            expect(mockCheckAutoLock).toHaveBeenCalledTimes(1)
            expect(result.current.isChecking).toBe(false)
        })

        expect(result.current.isLocked).toBe(false)
    })

    it('should re-check and lock when a lock is requested and a PIN is enabled', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)

        const { result, rerender } = renderHook(() => useAutoLockListener())

        await waitFor(() => {
            expect(result.current.isChecking).toBe(false)
        })
        expect(result.current.isLocked).toBe(false)

        mockCheckPinEnabled.mockResolvedValue(true)
        securityStoreState.lockRequestVersion = 1
        rerender()

        await waitFor(() => {
            expect(result.current.isLocked).toBe(true)
        })
    })

    it('should not lock on a lock request when no PIN is enabled', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)

        const { result, rerender } = renderHook(() => useAutoLockListener())

        await waitFor(() => {
            expect(result.current.isChecking).toBe(false)
        })

        securityStoreState.lockRequestVersion = 1
        rerender()

        await waitFor(() => {
            expect(mockCheckPinEnabled.mock.calls.length).toBeGreaterThan(1)
        })
        expect(result.current.isLocked).toBe(false)
    })

    it('should ignore malformed app state transitions', async () => {
        renderHook(() => useAutoLockListener())
        const handleAppStateChange = getAppStateChangeHandler()

        act(() => {
            handleAppStateChange('unknown')
            handleAppStateChange(undefined)
            handleAppStateChange(null)
        })

        expect(mockCheckAutoLock).not.toHaveBeenCalled()
        expect(mockSetAutoLockStartedAt).not.toHaveBeenCalled()
    })

    it('raises the checking overlay on the first foreground after a cold mount that started backgrounded', async () => {
        appStateState.currentState = 'background'
        let resolveCheck: (expired: boolean) => void = () => {}
        mockCheckAutoLock.mockImplementation(
            () =>
                new Promise<boolean>(resolve => {
                    resolveCheck = resolve
                }),
        )

        const { result } = renderHook(() => useAutoLockListener())

        await waitFor(() => {
            expect(result.current.isChecking).toBe(false)
        })

        // A silent-push cold launch (or the route-tree remount) can mount the
        // guard while the app is already backgrounded — the first foreground
        // transition it observes is still a real background return.
        act(() => {
            appStateChangeHandler?.('active')
        })

        expect(result.current.isChecking).toBe(true)

        await act(async () => {
            resolveCheck(false)
        })

        await waitFor(() => {
            expect(result.current.isChecking).toBe(false)
        })
    })

    describe('on iOS', () => {
        beforeEach(() => {
            platformState.OS = 'ios'
        })

        it('re-checks the lock on inactive->active without hiding the app behind the checking overlay', async () => {
            const { result } = renderHook(() => useAutoLockListener())

            await waitFor(() => {
                expect(result.current.isChecking).toBe(false)
            })

            // A notification banner or Face ID prompt drives inactive->active
            // without the app ever leaving the screen. Raising the checking
            // overlay there applies display:none to the whole app tree and
            // tears down whatever is mounted underneath (PERA-4870).
            act(() => {
                appStateChangeHandler?.('inactive')
                appStateChangeHandler?.('active')
            })

            expect(result.current.isChecking).toBe(false)

            await waitFor(() => {
                expect(mockCheckAutoLock).toHaveBeenCalledTimes(1)
            })

            expect(result.current.isChecking).toBe(false)
        })

        it('still locks from an inactive->active check when the timeout expired', async () => {
            mockCheckAutoLock.mockResolvedValue(true)

            const { result } = renderHook(() => useAutoLockListener())

            await waitFor(() => {
                expect(result.current.isChecking).toBe(false)
            })

            act(() => {
                appStateChangeHandler?.('inactive')
                appStateChangeHandler?.('active')
            })

            await waitFor(() => {
                expect(result.current.isLocked).toBe(true)
            })
        })

        it('raises the checking overlay when returning from a real background', async () => {
            let resolveCheck: (expired: boolean) => void = () => {}
            mockCheckAutoLock.mockImplementation(
                () =>
                    new Promise<boolean>(resolve => {
                        resolveCheck = resolve
                    }),
            )

            const { result } = renderHook(() => useAutoLockListener())

            await waitFor(() => {
                expect(result.current.isChecking).toBe(false)
            })

            // iOS leaves through inactive and returns through inactive, so the
            // background hop is the only thing that distinguishes a real
            // background from banner noise.
            act(() => {
                appStateChangeHandler?.('inactive')
                appStateChangeHandler?.('background')
                appStateChangeHandler?.('inactive')
                appStateChangeHandler?.('active')
            })

            expect(result.current.isChecking).toBe(true)

            await act(async () => {
                resolveCheck(false)
            })

            await waitFor(() => {
                expect(result.current.isChecking).toBe(false)
            })
        })

        it('does not leave the overlay flag stuck after a real background, so a later banner stays hidden', async () => {
            const { result } = renderHook(() => useAutoLockListener())

            await waitFor(() => {
                expect(result.current.isChecking).toBe(false)
            })

            act(() => {
                appStateChangeHandler?.('inactive')
                appStateChangeHandler?.('background')
                appStateChangeHandler?.('inactive')
                appStateChangeHandler?.('active')
            })

            await waitFor(() => {
                expect(result.current.isChecking).toBe(false)
            })

            act(() => {
                appStateChangeHandler?.('inactive')
                appStateChangeHandler?.('active')
            })

            expect(result.current.isChecking).toBe(false)
        })

        it('raises the overlay for a real background that arrives during an in-flight banner check', async () => {
            const resolvers: Array<(expired: boolean) => void> = []
            mockCheckAutoLock.mockImplementation(
                () =>
                    new Promise<boolean>(resolve => {
                        resolvers.push(resolve)
                    }),
            )

            const { result } = renderHook(() => useAutoLockListener())

            await waitFor(() => {
                expect(result.current.isChecking).toBe(false)
            })

            // A banner starts a check (no overlay, since it's not a real
            // background) while it is still pending.
            act(() => {
                appStateChangeHandler?.('inactive')
                appStateChangeHandler?.('active')
            })
            expect(mockCheckAutoLock).toHaveBeenCalledTimes(1)

            // A real background/return arrives while that banner check is
            // still in flight — it must not be dropped.
            act(() => {
                appStateChangeHandler?.('inactive')
                appStateChangeHandler?.('background')
                appStateChangeHandler?.('inactive')
                appStateChangeHandler?.('active')
            })

            await act(async () => {
                resolvers[0]?.(false)
            })

            await waitFor(() => {
                expect(mockCheckAutoLock).toHaveBeenCalledTimes(2)
            })
            expect(result.current.isChecking).toBe(true)

            await act(async () => {
                resolvers[1]?.(false)
            })

            await waitFor(() => {
                expect(result.current.isChecking).toBe(false)
            })
        })

        it('does not flash the overlay on a banner following a coalesced real-background check', async () => {
            const resolvers: Array<(expired: boolean) => void> = []
            mockCheckAutoLock.mockImplementation(
                () =>
                    new Promise<boolean>(resolve => {
                        resolvers.push(resolve)
                    }),
            )

            const { result } = renderHook(() => useAutoLockListener())

            await waitFor(() => {
                expect(result.current.isChecking).toBe(false)
            })

            act(() => {
                appStateChangeHandler?.('inactive')
                appStateChangeHandler?.('active')
            })

            act(() => {
                appStateChangeHandler?.('inactive')
                appStateChangeHandler?.('background')
                appStateChangeHandler?.('inactive')
                appStateChangeHandler?.('active')
            })

            await act(async () => {
                resolvers[0]?.(false)
            })
            await waitFor(() => {
                expect(mockCheckAutoLock).toHaveBeenCalledTimes(2)
            })

            await act(async () => {
                resolvers[1]?.(false)
            })
            await waitFor(() => {
                expect(result.current.isChecking).toBe(false)
            })

            // A later, unrelated banner must not see a stale flag from the
            // earlier real background.
            act(() => {
                appStateChangeHandler?.('inactive')
                appStateChangeHandler?.('active')
            })

            expect(result.current.isChecking).toBe(false)
        })
    })
})
