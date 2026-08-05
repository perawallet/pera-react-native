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

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError, PeraNetworkError } from '@perawallet/wallet-core-shared'
import { useWalletConnectErrorContent } from '../useWalletConnectErrorContent'

const mockConfig = vi.hoisted(() => ({ debugEnabled: false }))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: mockConfig,
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@hooks/useAlgodErrorMessage', () => ({
    useAlgodErrorMessage: () => ({
        getMessage: () => ({
            title: 'errors.algod.unknown_node_error.title',
            body: 'errors.algod.unknown_node_error.body',
        }),
    }),
}))

describe('useWalletConnectErrorContent', () => {
    beforeEach(() => {
        mockConfig.debugEnabled = false
    })

    it('falls back to the WalletConnect-specific unknown copy when there is no error', () => {
        const { result } = renderHook(() => useWalletConnectErrorContent(null))

        expect(result.current.errorBody).toBe('errors.walletconnect.unknown')
    })

    it('resolves localized copy rather than the raw AppError message', () => {
        const error = new AppError('raw internal detail', {})

        const { result } = renderHook(() => useWalletConnectErrorContent(error))

        expect(result.current.errorBody).not.toContain('raw internal detail')
        expect(result.current.errorBody).toBe('errors.general.body')
    })

    it('resolves localized copy for a typed PeraNetworkError', () => {
        const error = new PeraNetworkError('timeout')

        const { result } = renderHook(() => useWalletConnectErrorContent(error))

        expect(result.current.errorBody).toBe('errors.network.timeout.body')
    })

    it('appends the raw debug cause in debug builds without translating it', () => {
        mockConfig.debugEnabled = true
        const error = new AppError('raw internal detail', {}, undefined)
        Object.assign(error, { cause: new Error('root cause detail') })

        const { result } = renderHook(() => useWalletConnectErrorContent(error))

        expect(result.current.errorBody).toBe(
            'errors.general.body\n\nDebug: root cause detail',
        )
    })

    it('does not append debug info outside debug builds even with a cause', () => {
        mockConfig.debugEnabled = false
        const error = new AppError('raw internal detail', {}, undefined)
        Object.assign(error, { cause: new Error('root cause detail') })

        const { result } = renderHook(() => useWalletConnectErrorContent(error))

        expect(result.current.errorBody).toBe('errors.general.body')
    })
})
