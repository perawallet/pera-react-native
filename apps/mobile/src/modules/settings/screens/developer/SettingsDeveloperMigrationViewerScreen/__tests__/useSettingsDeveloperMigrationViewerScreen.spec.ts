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

const renderLoaded = async () => {
    const hook = renderHook(() => useSettingsDeveloperMigrationViewerScreen())
    await waitFor(() => {
        expect(hook.result.current.renderState.kind).not.toBe('loading')
    })
    return hook
}

describe('useSettingsDeveloperMigrationViewerScreen', () => {
    it('starts in the loading state', () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperMigrationViewerScreen(),
        )

        expect(result.current.renderState).toEqual({ kind: 'loading' })
    })

    it('loads payload and migration-complete flag on mount', async () => {
        migrationService.isMigrationComplete.mockResolvedValue(true)

        const { result } = await renderLoaded()

        expect(result.current.renderState).toEqual({
            kind: 'content',
            data: samplePayload,
        })
        expect(result.current.isMigrationComplete).toBe(true)
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

    it('surfaces an Error rejection as the error state with its message', async () => {
        migrationService.getLegacyData.mockRejectedValueOnce(new Error('boom'))

        const { result } = await renderLoaded()

        expect(result.current.renderState).toEqual({
            kind: 'error',
            message: 'boom',
        })
    })

    it('wraps non-Error rejections via String()', async () => {
        migrationService.isMigrationComplete.mockRejectedValueOnce(
            'string-fail',
        )

        const { result } = await renderLoaded()

        expect(result.current.renderState).toEqual({
            kind: 'error',
            message: 'string-fail',
        })
    })

    it('is empty when the payload is null with no error', async () => {
        migrationService.getLegacyData.mockResolvedValueOnce(null)

        const { result } = await renderLoaded()

        expect(result.current.renderState).toEqual({ kind: 'empty' })
    })

    it('prefers the error over stale data when a refresh fails', async () => {
        const { result } = await renderLoaded()

        migrationService.getLegacyData.mockRejectedValueOnce(
            new Error('refresh-fail'),
        )
        await act(async () => {
            result.current.refresh()
        })
        await waitFor(() => {
            expect(result.current.renderState.kind).toBe('error')
        })

        expect(result.current.renderState).toEqual({
            kind: 'error',
            message: 'refresh-fail',
        })
    })

    it('refresh() re-invokes both provider methods', async () => {
        const { result } = await renderLoaded()

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
        const { result } = await renderLoaded()

        migrationService.getLegacyData.mockResolvedValueOnce(samplePayload)
        await act(async () => {
            result.current.refresh()
        })
        await waitFor(() => {
            expect(result.current.renderState.kind).toBe('content')
        })

        expect(result.current.renderState).toEqual({
            kind: 'content',
            data: samplePayload,
        })
    })

    it.each([
        ['loaded data', samplePayload],
        ['a prior error', new Error('prior-fail')],
    ])(
        'shows loading over %s while a refresh is in flight',
        async (_label, firstResult) => {
            if (firstResult instanceof Error) {
                migrationService.getLegacyData.mockRejectedValueOnce(
                    firstResult,
                )
            }
            const { result } = await renderLoaded()

            let resolveLoad: (value: unknown) => void = () => undefined
            migrationService.getLegacyData.mockImplementationOnce(
                () => new Promise(resolve => (resolveLoad = resolve)),
            )

            act(() => {
                result.current.refresh()
            })
            expect(result.current.renderState).toEqual({ kind: 'loading' })

            await act(async () => {
                resolveLoad(samplePayload)
            })
            await waitFor(() => {
                expect(result.current.renderState.kind).toBe('content')
            })
        },
    )
})
