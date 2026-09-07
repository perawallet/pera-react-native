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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const {
    hasLegacyDataMock,
    isMigrationCompleteMock,
    getCompletedStepVersionsMock,
    setCompletedStepVersionsMock,
    getBooleanValueMock,
    keyValueStorage,
} = vi.hoisted(() => {
    const store = new Map<string, string>()
    return {
        hasLegacyDataMock: vi.fn(),
        isMigrationCompleteMock: vi.fn(),
        getCompletedStepVersionsMock: vi.fn(),
        setCompletedStepVersionsMock: vi.fn(),
        getBooleanValueMock: vi.fn(),
        keyValueStorage: {
            getItem: vi.fn((key: string) => store.get(key) ?? null),
            setItem: vi.fn((key: string, value: string) => {
                store.set(key, value)
            }),
            removeItem: vi.fn((key: string) => {
                store.delete(key)
            }),
            _store: store,
        },
    }
})

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        migration: {
            hasLegacyData: hasLegacyDataMock,
            isMigrationComplete: isMigrationCompleteMock,
            getCompletedStepVersions: getCompletedStepVersionsMock,
            setCompletedStepVersions: setCompletedStepVersionsMock,
        },
        keyValueStorage,
    }),
}))

vi.mock('@perawallet/wallet-core-remote-config', () => ({
    useRemoteConfig: () => ({
        getBooleanValue: getBooleanValueMock,
    }),
    RemoteConfigKeys: {
        pera_7_migration: 'pera_7_migration',
    },
}))

import { useNeedsMigration } from '../useNeedsMigration'
import { useMigrationGateStore } from '../../store'
import {
    ALL_MIGRATION_STEPS,
    MIGRATION_STEP_TARGET_VERSIONS,
} from '../../migrate/stepVersions'

const allStepsAtTarget = () =>
    Object.fromEntries(
        ALL_MIGRATION_STEPS.map(step => [
            step,
            MIGRATION_STEP_TARGET_VERSIONS[step],
        ]),
    )

beforeEach(() => {
    hasLegacyDataMock.mockReset()
    isMigrationCompleteMock.mockReset()
    getCompletedStepVersionsMock.mockReset()
    setCompletedStepVersionsMock.mockReset()
    getBooleanValueMock.mockReset()
    keyValueStorage._store.clear()
    // Default the flag to enabled so existing assertions hold; individual
    // tests override for the disabled case.
    getBooleanValueMock.mockImplementation((key: string, fallback: boolean) =>
        key === 'pera_7_migration' ? true : fallback,
    )
    // Default to "no per-step record yet" so pre-existing tests that only
    // stub hasLegacyData/isMigrationComplete keep exercising the legacy
    // sentinel fallback path in resolveCompletedStepVersions.
    getCompletedStepVersionsMock.mockResolvedValue(null)
    useMigrationGateStore.getState().resetState()
})

describe('useNeedsMigration', () => {
    it('flags needsMigration when legacy data exists and migration not complete', async () => {
        hasLegacyDataMock.mockResolvedValue(true)
        isMigrationCompleteMock.mockResolvedValue(false)

        const { result } = renderHook(() => useNeedsMigration())

        await waitFor(() => {
            expect(result.current.isChecking).toBe(false)
        })
        expect(result.current.needsMigration).toBe(true)
    })

    it('still needs migration for a legacy-sentinel user because accounts v2 must reconcile', async () => {
        // accounts target is 2 (watch-account reconciliation); a
        // legacy-sentinel-only user (no per-step record) is synthesized at
        // version 1 for every step, so accounts is pending once more even
        // though the old boolean sentinel says migration is "complete".
        hasLegacyDataMock.mockResolvedValue(true)
        isMigrationCompleteMock.mockResolvedValue(true)

        const { result } = renderHook(() => useNeedsMigration())

        await waitFor(() => {
            expect(result.current.isChecking).toBe(false)
        })
        expect(result.current.needsMigration).toBe(true)
    })

    it('clears needsMigration when migration is already complete at every step version', async () => {
        hasLegacyDataMock.mockResolvedValue(true)
        isMigrationCompleteMock.mockResolvedValue(true)
        getCompletedStepVersionsMock.mockResolvedValue(allStepsAtTarget())

        const { result } = renderHook(() => useNeedsMigration())

        await waitFor(() => {
            expect(result.current.isChecking).toBe(false)
        })
        expect(result.current.needsMigration).toBe(false)
    })

    it('clears needsMigration when there is no legacy data', async () => {
        hasLegacyDataMock.mockResolvedValue(false)
        isMigrationCompleteMock.mockResolvedValue(false)

        const { result } = renderHook(() => useNeedsMigration())

        await waitFor(() => {
            expect(result.current.isChecking).toBe(false)
        })
        expect(result.current.needsMigration).toBe(false)
    })

    it('dismiss() forces needsMigration to false without re-checking', async () => {
        hasLegacyDataMock.mockResolvedValue(true)
        isMigrationCompleteMock.mockResolvedValue(false)

        const { result } = renderHook(() => useNeedsMigration())
        await waitFor(() => {
            expect(result.current.needsMigration).toBe(true)
        })

        act(() => {
            result.current.dismiss()
        })

        expect(result.current.needsMigration).toBe(false)
    })

    it('falls back to needsMigration=false when the gate check throws', async () => {
        hasLegacyDataMock.mockRejectedValue(new Error('boom'))
        isMigrationCompleteMock.mockResolvedValue(false)

        const { result } = renderHook(() => useNeedsMigration())

        await waitFor(() => {
            expect(result.current.isChecking).toBe(false)
        })
        expect(result.current.needsMigration).toBe(false)
    })

    it('short-circuits to needsMigration=false when pera_7_migration flag is off', async () => {
        getBooleanValueMock.mockImplementation(
            (key: string, fallback: boolean) =>
                key === 'pera_7_migration' ? false : fallback,
        )
        hasLegacyDataMock.mockResolvedValue(true)
        isMigrationCompleteMock.mockResolvedValue(false)

        const { result } = renderHook(() => useNeedsMigration())

        await waitFor(() => {
            expect(result.current.isChecking).toBe(false)
        })
        expect(result.current.needsMigration).toBe(false)
        expect(hasLegacyDataMock).not.toHaveBeenCalled()
        expect(isMigrationCompleteMock).not.toHaveBeenCalled()
    })

    it('passes the documented default (false) when reading the feature flag', () => {
        renderHook(() => useNeedsMigration())

        expect(getBooleanValueMock).toHaveBeenCalledWith(
            'pera_7_migration',
            false,
        )
    })

    it('short-circuits to needsMigration=false when the user has skipped permanently', async () => {
        useMigrationGateStore.getState().setSkipped()
        hasLegacyDataMock.mockResolvedValue(true)
        isMigrationCompleteMock.mockResolvedValue(false)

        const { result } = renderHook(() => useNeedsMigration())

        await waitFor(() => {
            expect(result.current.isChecking).toBe(false)
        })
        expect(result.current.needsMigration).toBe(false)
        expect(hasLegacyDataMock).not.toHaveBeenCalled()
        expect(isMigrationCompleteMock).not.toHaveBeenCalled()
    })

    it('clearSkipped() flips the persisted skip flag back off', () => {
        useMigrationGateStore.getState().setSkipped()
        expect(useMigrationGateStore.getState().skipped).toBe(true)

        useMigrationGateStore.getState().clearSkipped()

        expect(useMigrationGateStore.getState().skipped).toBe(false)
    })

    it('only checks once per app session even with multiple subscribers', async () => {
        hasLegacyDataMock.mockResolvedValue(true)
        isMigrationCompleteMock.mockResolvedValue(false)

        const first = renderHook(() => useNeedsMigration())
        const second = renderHook(() => useNeedsMigration())

        await waitFor(() => {
            expect(first.result.current.isChecking).toBe(false)
            expect(second.result.current.isChecking).toBe(false)
        })

        expect(hasLegacyDataMock).toHaveBeenCalledTimes(1)
        expect(isMigrationCompleteMock).toHaveBeenCalledTimes(1)
    })

    it('needs migration when legacy data exists and a step is behind target', async () => {
        hasLegacyDataMock.mockResolvedValue(true)
        isMigrationCompleteMock.mockResolvedValue(true) // legacy sentinel set
        getCompletedStepVersionsMock.mockResolvedValue({
            ...allStepsAtTarget(),
            deviceIdentifiers: 0,
        })

        const { result } = renderHook(() => useNeedsMigration())

        await waitFor(() => {
            expect(result.current.isChecking).toBe(false)
        })
        expect(result.current.needsMigration).toBe(true)
    })

    it('does not need migration when all steps are at target', async () => {
        hasLegacyDataMock.mockResolvedValue(true)
        getCompletedStepVersionsMock.mockResolvedValue(allStepsAtTarget())

        const { result } = renderHook(() => useNeedsMigration())

        await waitFor(() => {
            expect(result.current.isChecking).toBe(false)
        })
        expect(result.current.needsMigration).toBe(false)
    })
})
