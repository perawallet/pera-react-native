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
import { renderHook } from '@testing-library/react'
import { AppState } from 'react-native'

type FakeKeystoreKey = {
    id: string
    type: string
    metadata?: Record<string, unknown>
}

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
    keysRef,
    keystoreListeners,
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
    keysRef: { current: [] as FakeKeystoreKey[] },
    keystoreListeners: new Set<() => void>(),
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
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
    unwiredPasskeyListFn: async () => [],
    unwiredPasskeyImportFn: async () => ({
        imported: 0,
        skipped: [],
        failed: [],
    }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => ({
        get state() {
            return { keys: keysRef.current }
        },
        subscribe: (listener: () => void) => {
            keystoreListeners.add(listener)
            return { unsubscribe: () => keystoreListeners.delete(listener) }
        },
    }),
}))

vi.mock('@perawallet/wallet-core-passkeys', () => ({
    isPasskeyKey: (key: FakeKeystoreKey) => key.type === 'hd-derived-p256',
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { error: vi.fn() },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: showToastMock }),
}))

vi.mock('@hooks/useIsCloudBackupEnabled', () => ({
    useIsCloudBackupEnabled: isEnabledMock,
}))

import { useBackupSyncLifecycle } from '../useBackupSyncLifecycle'

const setAppState = (state: string) => {
    ;(AppState as { currentState: string }).currentState = state
}

/** Fires the listener the hook registered with AppState. */
const emitAppState = (state: string) => {
    const listener = (AppState.addEventListener as Mock).mock.calls.at(-1)?.[1]
    listener?.(state)
}

/** Fires every listener registered with the fake keystore store, simulating a
 *  `setState` — matching how `@tanstack/store` notifies on every write. */
const emitKeystoreChange = () => {
    for (const listener of [...keystoreListeners]) listener()
}

describe('useBackupSyncLifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        isEnabledMock.mockReturnValue(true)
        backupIdRef.current = 'did:pera:abc'
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

    describe('subscribePasskeyChanges', () => {
        beforeEach(() => {
            keysRef.current = []
            keystoreListeners.clear()
        })

        it('does not report an unrelated keystore write', () => {
            keysRef.current = [{ id: 'seed-1', type: 'hd-root-key' }]
            renderHook(() => useBackupSyncLifecycle())
            const deps = (initializeMock as Mock).mock.calls[0][0]
            const onChange = vi.fn()
            deps.subscribePasskeyChanges(onChange)

            // An HD derivation adds a non-passkey key; the passkey fingerprint
            // (ids + counters of hd-derived-p256 keys only) is unchanged.
            keysRef.current = [
                { id: 'seed-1', type: 'hd-root-key' },
                { id: 'seed-2', type: 'hd-root-key' },
            ]
            emitKeystoreChange()

            expect(onChange).not.toHaveBeenCalled()
        })

        it('reports a real passkey change', () => {
            keysRef.current = [
                {
                    id: 'cred-1',
                    type: 'hd-derived-p256',
                    metadata: { counter: 0 },
                },
            ]
            renderHook(() => useBackupSyncLifecycle())
            const deps = (initializeMock as Mock).mock.calls[0][0]
            const onChange = vi.fn()
            deps.subscribePasskeyChanges(onChange)

            keysRef.current = [
                {
                    id: 'cred-1',
                    type: 'hd-derived-p256',
                    metadata: { counter: 1 },
                },
            ]
            emitKeystoreChange()

            expect(onChange).toHaveBeenCalledTimes(1)
        })

        it('reports a new passkey being added', () => {
            keysRef.current = []
            renderHook(() => useBackupSyncLifecycle())
            const deps = (initializeMock as Mock).mock.calls[0][0]
            const onChange = vi.fn()
            deps.subscribePasskeyChanges(onChange)

            keysRef.current = [
                {
                    id: 'cred-1',
                    type: 'hd-derived-p256',
                    metadata: { counter: 0 },
                },
            ]
            emitKeystoreChange()

            expect(onChange).toHaveBeenCalledTimes(1)
        })

        it('stops reporting once unsubscribed', () => {
            keysRef.current = [
                {
                    id: 'cred-1',
                    type: 'hd-derived-p256',
                    metadata: { counter: 0 },
                },
            ]
            renderHook(() => useBackupSyncLifecycle())
            const deps = (initializeMock as Mock).mock.calls[0][0]
            const onChange = vi.fn()
            const unsubscribe = deps.subscribePasskeyChanges(onChange)
            unsubscribe()

            keysRef.current = [
                {
                    id: 'cred-1',
                    type: 'hd-derived-p256',
                    metadata: { counter: 1 },
                },
            ]
            emitKeystoreChange()

            expect(onChange).not.toHaveBeenCalled()
        })
    })
})
