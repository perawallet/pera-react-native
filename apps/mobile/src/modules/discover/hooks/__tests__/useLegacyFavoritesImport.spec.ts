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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { config } from '@perawallet/wallet-core-config'
import { DiscoverEvent, trackEvent } from '@analytics'
import { useNetworkStatusStore } from '@hooks/useNetworkStatusStore'
import { useDiscoverFavoritesStore } from '../../store/useDiscoverFavoritesStore'
import { LEGACY_FAVORITES_MESSAGE_TYPE } from '../../utils/legacyFavorites'
import { useDiscoverDirectory } from '../useDiscoverDirectory'
import {
    LEGACY_IMPORT_TIMEOUT_MS,
    resetLegacyImportAttemptForTests,
    useLegacyFavoritesImport,
} from '../useLegacyFavoritesImport'

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: vi.fn(),
}))
vi.mock('../useDiscoverDirectory', () => ({ useDiscoverDirectory: vi.fn() }))

const trustedUrl = `${config.discoverBaseUrl}/`
const payload = (favorites: unknown, unreadableKeys = 0) => ({
    type: LEGACY_FAVORITES_MESSAGE_TYPE,
    favorites,
    unreadableKeys,
})
const legacyA = { name: 'A', url: 'https://a.io', logo: null }
const store = () => useDiscoverFavoritesStore.getState()

const mockDirectory = (isLoading: boolean) =>
    vi.mocked(useDiscoverDirectory).mockReturnValue({
        projects: [],
        isLoading,
    } as never)

describe('useLegacyFavoritesImport', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.clearAllMocks()
        store().resetState()
        resetLegacyImportAttemptForTests()
        useNetworkStatusStore.setState({ hasInternet: true })
        mockDirectory(false)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('stays inactive while the directory loads', () => {
        mockDirectory(true)
        const { result } = renderHook(() => useLegacyFavoritesImport())

        expect(result.current.isActive).toBe(false)
    })

    it('stays inactive once the import is done', () => {
        store().importLegacyFavorites([], {})
        const { result } = renderHook(() => useLegacyFavoritesImport())

        expect(result.current.isActive).toBe(false)
    })

    it('imports a trusted payload and tracks the counts', () => {
        const { result } = renderHook(() => useLegacyFavoritesImport())
        expect(result.current.isActive).toBe(true)

        act(() =>
            result.current.onMessage(
                trustedUrl,
                payload([legacyA, { name: '', url: 'https://b.io' }]),
            ),
        )

        expect(store().isFavorite('https://a.io')).toBe(true)
        expect(store().legacyImport.status).toBe('done')
        expect(trackEvent).toHaveBeenCalledWith(
            DiscoverEvent.LegacyFavoritesImported,
            {
                imported_count: 1,
                skipped_count: 1,
                already_favorite_count: 0,
                unreadable_key_count: 0,
            },
        )
        expect(result.current.isActive).toBe(false)
    })

    it('reports a broken legacy key in the imported event', () => {
        const { result } = renderHook(() => useLegacyFavoritesImport())

        act(() => result.current.onMessage(trustedUrl, payload([legacyA], 1)))

        expect(store().isFavorite('https://a.io')).toBe(true)
        expect(trackEvent).toHaveBeenCalledWith(
            DiscoverEvent.LegacyFavoritesImported,
            expect.objectContaining({ unreadable_key_count: 1 }),
        )
    })

    it('ignores a message from another origin and keeps waiting', () => {
        const { result } = renderHook(() => useLegacyFavoritesImport())

        act(() =>
            result.current.onMessage(
                'https://ads.example/',
                payload([legacyA]),
            ),
        )

        expect(store().isFavorite('https://a.io')).toBe(false)
        expect(store().legacyImport).toEqual({ status: 'pending', attempts: 0 })
        expect(result.current.isActive).toBe(true)
    })

    it("ignores the page's own messages and still imports the reader's", () => {
        const { result } = renderHook(() => useLegacyFavoritesImport())

        act(() => {
            result.current.onMessage(trustedUrl, { type: 'bridge', id: 1 })
            result.current.onMessage(trustedUrl, undefined)
        })
        expect(store().legacyImport).toEqual({ status: 'pending', attempts: 0 })
        expect(result.current.isActive).toBe(true)

        act(() => result.current.onMessage(trustedUrl, payload([legacyA])))

        expect(store().isFavorite('https://a.io')).toBe(true)
    })

    it('fails a malformed payload', () => {
        const { result } = renderHook(() => useLegacyFavoritesImport())

        act(() => result.current.onMessage(trustedUrl, payload(null)))

        expect(store().legacyImport).toEqual({ status: 'pending', attempts: 1 })
    })

    it('fails a load error', () => {
        const { result } = renderHook(() => useLegacyFavoritesImport())

        act(() => result.current.onFailure('load_error'))

        expect(store().legacyImport).toEqual({ status: 'pending', attempts: 1 })
        expect(result.current.isActive).toBe(false)
    })

    it('does not time out while the page is still loading', () => {
        const { result } = renderHook(() => useLegacyFavoritesImport())

        act(() => vi.advanceTimersByTime(LEGACY_IMPORT_TIMEOUT_MS * 3))

        expect(store().legacyImport).toEqual({ status: 'pending', attempts: 0 })
        expect(result.current.isActive).toBe(true)
    })

    it('times out 10 s after the page loads', () => {
        const { result } = renderHook(() => useLegacyFavoritesImport())
        act(() => result.current.onPageLoad())

        act(() => vi.advanceTimersByTime(LEGACY_IMPORT_TIMEOUT_MS - 1))
        expect(store().legacyImport.attempts).toBe(0)
        act(() => vi.advanceTimersByTime(1))

        expect(store().legacyImport).toEqual({ status: 'pending', attempts: 1 })
        expect(result.current.isActive).toBe(false)
    })

    it('ignores a message that arrives after the timeout', () => {
        const { result } = renderHook(() => useLegacyFavoritesImport())
        act(() => result.current.onPageLoad())
        act(() => vi.advanceTimersByTime(LEGACY_IMPORT_TIMEOUT_MS))

        act(() => result.current.onMessage(trustedUrl, payload([legacyA])))

        expect(store().isFavorite('https://a.io')).toBe(false)
        expect(store().legacyImport.attempts).toBe(1)
    })

    it('tracks the give-up on the third failure', () => {
        store().recordLegacyImportFailure()
        store().recordLegacyImportFailure()
        const { result } = renderHook(() => useLegacyFavoritesImport())
        act(() => result.current.onPageLoad())

        act(() => vi.advanceTimersByTime(LEGACY_IMPORT_TIMEOUT_MS))

        expect(store().legacyImport.status).toBe('gave_up')
        expect(trackEvent).toHaveBeenCalledWith(
            DiscoverEvent.LegacyFavoritesImportFailed,
            { attempt_count: 3, failure_reason: 'timeout' },
        )
    })

    it('does not track a failure before giving up', () => {
        const { result } = renderHook(() => useLegacyFavoritesImport())

        act(() => result.current.onFailure('http_error'))

        expect(trackEvent).not.toHaveBeenCalled()
    })

    it('runs at most one attempt per launch', () => {
        const first = renderHook(() => useLegacyFavoritesImport())
        act(() => first.result.current.onFailure('load_error'))
        first.unmount()

        const second = renderHook(() => useLegacyFavoritesImport())

        expect(second.result.current.isActive).toBe(false)
    })

    it('keeps the attempt when the home unmounts mid-attempt, touching nothing', () => {
        const first = renderHook(() => useLegacyFavoritesImport())
        act(() => first.result.current.onPageLoad())
        first.unmount()
        act(() => vi.advanceTimersByTime(LEGACY_IMPORT_TIMEOUT_MS))

        expect(store().legacyImport).toEqual({ status: 'pending', attempts: 0 })
    })

    it('waits for a connection before starting', () => {
        useNetworkStatusStore.setState({ hasInternet: false })
        const { result, rerender } = renderHook(() =>
            useLegacyFavoritesImport(),
        )
        expect(result.current.isActive).toBe(false)

        act(() => useNetworkStatusStore.setState({ hasInternet: true }))
        rerender()

        expect(result.current.isActive).toBe(true)
    })

    it('does not count a load error or timeout that happens offline', () => {
        const { result } = renderHook(() => useLegacyFavoritesImport())
        act(() => useNetworkStatusStore.setState({ hasInternet: false }))

        act(() => result.current.onFailure('load_error'))

        expect(store().legacyImport).toEqual({ status: 'pending', attempts: 0 })
        expect(result.current.isActive).toBe(false)
    })

    it('queries the directory only while an import is pending', () => {
        renderHook(() => useLegacyFavoritesImport())
        // Enabled until the attempt starts; the started attempt reads the cache.
        expect(useDiscoverDirectory).toHaveBeenNthCalledWith(1, {
            isEnabled: true,
        })

        vi.mocked(useDiscoverDirectory).mockClear()
        store().importLegacyFavorites([], {})
        resetLegacyImportAttemptForTests()
        renderHook(() => useLegacyFavoritesImport())

        expect(useDiscoverDirectory).toHaveBeenLastCalledWith({
            isEnabled: false,
        })
    })
})
