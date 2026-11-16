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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHistoryFailedNotice } from '../useHistoryFailedNotice'

const mockUseNetworkStatus = vi.hoisted(() => vi.fn())
vi.mock('@modules/network', () => ({
    useNetworkStatus: mockUseNetworkStatus,
}))

describe('useHistoryFailedNotice', () => {
    const onRetry = vi.fn()

    beforeEach(() => {
        mockUseNetworkStatus.mockReturnValue({ hasInternet: true })
    })

    it('names every failed network and offers a retry', () => {
        const { result } = renderHook(() =>
            useHistoryFailedNotice({
                networkNames: ['Ethereum', 'Base'],
                isRetryable: true,
                onRetry,
            }),
        )

        expect(result.current.isVisible).toBe(true)
        expect(result.current.params).toEqual({ networks: 'Ethereum, Base' })
        expect(result.current.action).toEqual({
            labelKey: 'common.retry.label',
            onPress: onRetry,
        })
    })

    it('offers no retry where retrying cannot help', () => {
        const { result } = renderHook(() =>
            useHistoryFailedNotice({
                networkNames: ['Sepolia'],
                isRetryable: false,
                onRetry,
            }),
        )

        expect(result.current.isVisible).toBe(true)
        expect(result.current.action).toBeUndefined()
    })

    it('hides while offline, and with no failed network', () => {
        mockUseNetworkStatus.mockReturnValue({ hasInternet: false })
        const offline = renderHook(() =>
            useHistoryFailedNotice({
                networkNames: ['Ethereum'],
                isRetryable: true,
                onRetry,
            }),
        )
        mockUseNetworkStatus.mockReturnValue({ hasInternet: true })
        const none = renderHook(() =>
            useHistoryFailedNotice({
                networkNames: [],
                isRetryable: true,
                onRetry,
            }),
        )

        expect(offline.result.current.isVisible).toBe(false)
        expect(none.result.current.isVisible).toBe(false)
    })
})
