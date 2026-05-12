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
import { act, renderHook } from '@testing-library/react'
import {
    useHardwareSigning,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import type { UseHardwareSigningResult } from '@perawallet/wallet-core-signing'
import { useLedgerSigningOverlay } from '../useLedgerSigningOverlay'

vi.mock('@perawallet/wallet-core-signing', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-signing')>()
    return {
        ...actual,
        useSigningRequest: vi.fn(),
        useHardwareSigning: vi.fn(),
    }
})

const buildHardwareSigningResult = (
    overrides: Partial<UseHardwareSigningResult>,
): UseHardwareSigningResult => ({
    isActive: true,
    status: 'awaitingApproval',
    deviceName: 'Nano X',
    currentTx: null,
    totalTxs: null,
    requestId: 'req-1',
    error: null,
    resolveActiveRequest: vi.fn(() => undefined),
    dismiss: vi.fn(),
    ...overrides,
})

describe('useLedgerSigningOverlay', () => {
    beforeEach(() => {
        vi.mocked(useSigningRequest).mockReturnValue({
            pendingSignRequests: [],
            rejectRequest: vi.fn(),
            retryRequest: vi.fn(),
        } as never)
    })

    it('isVisible is false when status is "idle"', () => {
        vi.mocked(useHardwareSigning).mockReturnValue(
            buildHardwareSigningResult({ isActive: false, status: 'idle' }),
        )
        const { result } = renderHook(() => useLedgerSigningOverlay())
        expect(result.current.isVisible).toBe(false)
    })

    it('isVisible is false when status is "searching" (silent-scan phase)', () => {
        vi.mocked(useHardwareSigning).mockReturnValue(
            buildHardwareSigningResult({
                isActive: false,
                status: 'searching',
            }),
        )
        const { result } = renderHook(() => useLedgerSigningOverlay())
        expect(result.current.isVisible).toBe(false)
    })

    it('isVisible is true when status is "awaitingApproval"', () => {
        vi.mocked(useHardwareSigning).mockReturnValue(
            buildHardwareSigningResult({
                isActive: true,
                status: 'awaitingApproval',
            }),
        )
        const { result } = renderHook(() => useLedgerSigningOverlay())
        expect(result.current.isVisible).toBe(true)
    })

    it('isVisible is true when status is "error"', () => {
        vi.mocked(useHardwareSigning).mockReturnValue(
            buildHardwareSigningResult({ isActive: true, status: 'error' }),
        )
        const { result } = renderHook(() => useLedgerSigningOverlay())
        expect(result.current.isVisible).toBe(true)
    })

    it('exposes a derived LedgerErrorPreset when error payload is set', () => {
        vi.mocked(useHardwareSigning).mockReturnValue(
            buildHardwareSigningResult({
                status: 'error',
                error: { kind: 'app_not_open' },
            }),
        )
        const { result } = renderHook(() => useLedgerSigningOverlay())
        expect(result.current.error?.kind).toBe('app_not_open')
        expect(result.current.error?.isRetryable).toBe(true)
        expect(result.current.error?.isTroubleshootable).toBe(false)
    })

    it('onCancel rejects the active request, dismisses store, and closes troubleshooting', () => {
        const rejectRequest = vi.fn()
        const dismiss = vi.fn()
        const activeRequest = { id: 'req-1' } as never
        vi.mocked(useSigningRequest).mockReturnValue({
            pendingSignRequests: [activeRequest],
            rejectRequest,
            retryRequest: vi.fn(),
        } as never)
        vi.mocked(useHardwareSigning).mockReturnValue(
            buildHardwareSigningResult({
                resolveActiveRequest: () => activeRequest,
                dismiss,
            }),
        )
        const { result } = renderHook(() => useLedgerSigningOverlay())
        act(() => {
            result.current.onOpenTroubleshooting()
        })
        act(() => {
            result.current.onCancel()
        })
        expect(rejectRequest).toHaveBeenCalledWith(activeRequest)
        expect(dismiss).toHaveBeenCalledOnce()
        expect(result.current.isTroubleshootingVisible).toBe(false)
    })

    it('onRetry is a no-op when error is not retryable', () => {
        const retryRequest = vi.fn()
        vi.mocked(useSigningRequest).mockReturnValue({
            pendingSignRequests: [{ id: 'req-1' }],
            rejectRequest: vi.fn(),
            retryRequest,
        } as never)
        vi.mocked(useHardwareSigning).mockReturnValue(
            buildHardwareSigningResult({
                status: 'error',
                error: { kind: 'address_mismatch' },
                resolveActiveRequest: () => ({ id: 'req-1' }) as never,
            }),
        )
        const { result } = renderHook(() => useLedgerSigningOverlay())
        act(() => {
            result.current.onRetry()
        })
        expect(retryRequest).not.toHaveBeenCalled()
    })

    it('onOpenTroubleshooting / onCloseTroubleshooting flips local state', () => {
        vi.mocked(useHardwareSigning).mockReturnValue(
            buildHardwareSigningResult({ status: 'error' }),
        )
        const { result } = renderHook(() => useLedgerSigningOverlay())
        expect(result.current.isTroubleshootingVisible).toBe(false)
        act(() => result.current.onOpenTroubleshooting())
        expect(result.current.isTroubleshootingVisible).toBe(true)
        act(() => result.current.onCloseTroubleshooting())
        expect(result.current.isTroubleshootingVisible).toBe(false)
    })
})
