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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const { migrationService } = vi.hoisted(() => ({
    migrationService: {
        getLegacyData: vi.fn(),
        isMigrationComplete: vi.fn(),
    },
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ migration: migrationService }),
}))

import { useSettingsDeveloperMigrationViewerScreen } from '../useSettingsDeveloperMigrationViewerScreen'

const samplePayload = {
    schemaVersion: 1,
    accounts: [],
} as unknown as Awaited<ReturnType<typeof migrationService.getLegacyData>>

beforeEach(() => {
    migrationService.getLegacyData.mockReset()
    migrationService.isMigrationComplete.mockReset()
    migrationService.getLegacyData.mockResolvedValue(samplePayload)
    migrationService.isMigrationComplete.mockResolvedValue(false)
})

describe('useSettingsDeveloperMigrationViewerScreen', () => {
    it('starts in a loading state with no data and no error', () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperMigrationViewerScreen(),
        )

        expect(result.current.isLoading).toBe(true)
        expect(result.current.data).toBeNull()
        expect(result.current.error).toBeNull()
    })

    it('loads payload and migration-complete flag on mount', async () => {
        migrationService.isMigrationComplete.mockResolvedValue(true)

        const { result } = renderHook(() =>
            useSettingsDeveloperMigrationViewerScreen(),
        )

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })
        expect(result.current.data).toBe(samplePayload)
        expect(result.current.isMigrationComplete).toBe(true)
        expect(result.current.error).toBeNull()
    })

    it('runs getLegacyData and isMigrationComplete in parallel', async () => {
        const callOrder: string[] = []
        migrationService.getLegacyData.mockImplementation(async () => {
            callOrder.push('getLegacyData')
            return samplePayload
        })
        migrationService.isMigrationComplete.mockImplementation(async () => {
            callOrder.push('isMigrationComplete')
            return false
        })

        renderHook(() => useSettingsDeveloperMigrationViewerScreen())

        await waitFor(() => {
            expect(callOrder).toHaveLength(2)
        })
        expect(callOrder).toContain('getLegacyData')
        expect(callOrder).toContain('isMigrationComplete')
    })

    it('captures an Error rejection from the provider call', async () => {
        const boom = new Error('boom')
        migrationService.getLegacyData.mockRejectedValueOnce(boom)

        const { result } = renderHook(() =>
            useSettingsDeveloperMigrationViewerScreen(),
        )

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })
        expect(result.current.error).toBe(boom)
        expect(result.current.data).toBeNull()
    })

    it('wraps non-Error rejections via String()', async () => {
        migrationService.isMigrationComplete.mockRejectedValueOnce(
            'string-fail',
        )

        const { result } = renderHook(() =>
            useSettingsDeveloperMigrationViewerScreen(),
        )

        await waitFor(() => {
            expect(result.current.error).not.toBeNull()
        })
        expect(result.current.error).toBeInstanceOf(Error)
        expect(result.current.error?.message).toBe('string-fail')
    })

    it('refresh() re-invokes both provider methods', async () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperMigrationViewerScreen(),
        )

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        migrationService.getLegacyData.mockClear()
        migrationService.isMigrationComplete.mockClear()

        await act(async () => {
            result.current.refresh()
        })

        expect(migrationService.getLegacyData).toHaveBeenCalledTimes(1)
        expect(migrationService.isMigrationComplete).toHaveBeenCalledTimes(1)
    })

    it('clears a prior error when refresh succeeds', async () => {
        migrationService.getLegacyData.mockRejectedValueOnce(
            new Error('first-fail'),
        )
        const { result } = renderHook(() =>
            useSettingsDeveloperMigrationViewerScreen(),
        )
        await waitFor(() => {
            expect(result.current.error).not.toBeNull()
        })

        migrationService.getLegacyData.mockResolvedValueOnce(samplePayload)
        await act(async () => {
            result.current.refresh()
        })
        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.error).toBeNull()
        expect(result.current.data).toBe(samplePayload)
    })

    it('toggles isLoading to true while refresh is in flight', async () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperMigrationViewerScreen(),
        )
        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        let resolveLoad: (value: unknown) => void = () => {}
        migrationService.getLegacyData.mockImplementationOnce(
            () => new Promise(resolve => (resolveLoad = resolve)),
        )

        act(() => {
            result.current.refresh()
        })
        expect(result.current.isLoading).toBe(true)

        await act(async () => {
            resolveLoad(samplePayload)
        })
        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })
    })
})
