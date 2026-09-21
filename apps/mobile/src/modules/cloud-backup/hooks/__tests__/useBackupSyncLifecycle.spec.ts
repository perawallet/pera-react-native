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

import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest'
import { act, render, renderHook } from '@testing-library/react'
import { createElement, useEffect } from 'react'
import { AppState } from 'react-native'

const {
    initializeMock,
    managerMock,
    showToastMock,
    importAccountsMock,
    importContactsMock,
    resolveHdMock,
    resolveMnemonicMock,
    isEnabledMock,
    backupIdRef,
} = vi.hoisted(() => ({
    initializeMock: vi.fn(),
    managerMock: { start: vi.fn(), stop: vi.fn() },
    showToastMock: vi.fn(),
    importAccountsMock: vi.fn(),
    importContactsMock: vi.fn(),
    resolveHdMock: vi.fn(),
    resolveMnemonicMock: vi.fn(),
    isEnabledMock: vi.fn(),
    backupIdRef: { current: null as string | null },
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    createBackupSyncStoreSources: () => ({}),
    initializeBackupSyncManager: initializeMock,
    getBackupSyncManager: () => managerMock,
    useCloudBackupImport: () => ({ importAccounts: importAccountsMock }),
    useCloudBackupContactImport: () => ({
        importContacts: importContactsMock,
    }),
    useCloudBackupStore: (select: (state: unknown) => unknown) =>
        select({ backupId: backupIdRef.current }),
    useResolveHdSeedForBackup: () => resolveHdMock,
    useResolveMnemonicForBackup: () => resolveMnemonicMock,
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { error: vi.fn() },
    registerStore: vi.fn(),
}))

vi.mock('@hooks/useLanguage')

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: showToastMock }),
}))

vi.mock('@hooks/useIsCloudBackupEnabled', () => ({
    useIsCloudBackupEnabled: isEnabledMock,
}))

import { useSecurityStore } from '@perawallet/wallet-core-security'
import { useBackupSyncLifecycle } from '../useBackupSyncLifecycle'

const setAppState = (state: string) => {
    ;(AppState as { currentState: string }).currentState = state
}

/** Fires the listener the hook registered with AppState. */
const emitAppState = (state: string) => {
    const listener = (AppState.addEventListener as Mock).mock.calls.at(-1)?.[1]
    listener?.(state)
}

describe('useBackupSyncLifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        isEnabledMock.mockReturnValue(true)
        backupIdRef.current = 'did:pera:abc'
        act(() => useSecurityStore.getState().setAppLockActive(false))
        setAppState('active')
    })

    it('leaves the manager stopped while the feature flag is off', () => {
        isEnabledMock.mockReturnValue(false)

        renderHook(() => useBackupSyncLifecycle())

        // Initialization is unconditional so `getBackupSyncManager` never
        // throws for a consumer that reaches it another way.
        expect(initializeMock).toHaveBeenCalledTimes(1)
        expect(managerMock.start).not.toHaveBeenCalled()
    })

    it('leaves the manager stopped until a backup is configured', () => {
        backupIdRef.current = null

        const { rerender } = renderHook(() => useBackupSyncLifecycle())
        expect(managerMock.start).not.toHaveBeenCalled()

        backupIdRef.current = 'did:pera:abc'
        rerender()

        expect(managerMock.start).toHaveBeenCalledTimes(1)
    })

    it('starts the manager when enabled and stops it on unmount', () => {
        const { unmount } = renderHook(() => useBackupSyncLifecycle())

        expect(managerMock.start).toHaveBeenCalledTimes(1)

        unmount()
        expect(managerMock.stop).toHaveBeenCalled()
    })

    it('waits for the app lock overlay to clear before syncing', () => {
        act(() => useSecurityStore.getState().setAppLockActive(true))

        renderHook(() => useBackupSyncLifecycle())
        expect(managerMock.start).not.toHaveBeenCalled()

        act(() => useSecurityStore.getState().setAppLockActive(false))

        expect(managerMock.start).toHaveBeenCalledTimes(1)
    })

    it('stops the manager when the app locks mid-session', () => {
        renderHook(() => useBackupSyncLifecycle())
        expect(managerMock.start).toHaveBeenCalledTimes(1)

        act(() => useSecurityStore.getState().setAppLockActive(true))

        expect(managerMock.stop).toHaveBeenCalled()
    })

    it('waits for the foreground when the app cold-starts in the background', () => {
        // Push-launched and iOS-prewarmed starts run with no UI on screen, and
        // syncing reads every account's key material.
        setAppState('background')

        renderHook(() => useBackupSyncLifecycle())
        expect(managerMock.start).not.toHaveBeenCalled()

        emitAppState('active')
        expect(managerMock.start).toHaveBeenCalledTimes(1)
    })

    it('initializes once across re-renders so the live socket survives', () => {
        const { rerender } = renderHook(() => useBackupSyncLifecycle())

        rerender()
        rerender()

        expect(initializeMock).toHaveBeenCalledTimes(1)
    })

    it('toasts when the server reports the backup was deleted elsewhere', () => {
        renderHook(() => useBackupSyncLifecycle())

        const deps = (initializeMock as Mock).mock.calls[0][0]
        deps.onBackupDeleted()

        expect(showToastMock).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'cloud_backup.deleted_remotely',
                type: 'info',
            }),
        )
    })

    // AutoLockGuard is a child of the component that runs this hook, so its
    // effect cannot raise the flag before the parent's effect has already
    // captured it — only the store's own default gates the first render.
    it('gates a cold start on the store default, before the guard reports in', async () => {
        vi.resetModules()
        const { useSecurityStore: freshStore } =
            await import('@perawallet/wallet-core-security')
        const { useBackupSyncLifecycle: freshHook } =
            await import('../useBackupSyncLifecycle')

        const LockRaiser = () => {
            const setAppLockActive = freshStore(state => state.setAppLockActive)
            useEffect(() => {
                setAppLockActive(true)
            }, [setAppLockActive])
            return null
        }
        const Root = () => {
            freshHook()
            return createElement(LockRaiser)
        }

        render(createElement(Root))

        expect(managerMock.start).not.toHaveBeenCalled()
    })
})
