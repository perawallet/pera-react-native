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
    useHardwareSigningStore,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import type { UseHardwareSigningResult } from '@perawallet/wallet-core-signing'
import { useLedgerSigningContent } from '../useLedgerSigningContent'

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

describe('useLedgerSigningContent', () => {
    beforeEach(() => {
        useHardwareSigningStore.getState().resetState()
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
        const { result } = renderHook(() => useLedgerSigningContent())
        expect(result.current.isVisible).toBe(false)
    })

    it('isVisible is false when status is "searching" (silent-scan phase)', () => {
        vi.mocked(useHardwareSigning).mockReturnValue(
            buildHardwareSigningResult({
                isActive: false,
                status: 'searching',
            }),
        )
        const { result } = renderHook(() => useLedgerSigningContent())
        expect(result.current.isVisible).toBe(false)
    })

    it('isVisible is true when status is "awaitingApproval"', () => {
        vi.mocked(useHardwareSigning).mockReturnValue(
            buildHardwareSigningResult({
                isActive: true,
                status: 'awaitingApproval',
            }),
        )
        const { result } = renderHook(() => useLedgerSigningContent())
        expect(result.current.isVisible).toBe(true)
    })

    it('isVisible is true when status is "error"', () => {
        vi.mocked(useHardwareSigning).mockReturnValue(
            buildHardwareSigningResult({ isActive: true, status: 'error' }),
        )
        const { result } = renderHook(() => useLedgerSigningContent())
        expect(result.current.isVisible).toBe(true)
    })

    it('exposes a derived LedgerErrorPreset when error payload is set', () => {
        vi.mocked(useHardwareSigning).mockReturnValue(
            buildHardwareSigningResult({
                status: 'error',
                error: { kind: 'app_not_open' },
            }),
        )
        const { result } = renderHook(() => useLedgerSigningContent())
        expect(result.current.error?.kind).toBe('app_not_open')
        expect(result.current.error?.isRetryable).toBe(true)
        expect(result.current.error?.isTroubleshootable).toBe(false)
    })

    it('onCancel rejects the active request and dismisses the store (which resets all flags)', () => {
        const rejectRequest = vi.fn()
        const dismiss = vi.fn(() => {
            // Simulate what dismiss() actually does: reset the store state
            useHardwareSigningStore.getState().resetState()
        })
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
        const { result } = renderHook(() => useLedgerSigningContent())
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
        const { result } = renderHook(() => useLedgerSigningContent())
        act(() => {
            result.current.onRetry()
        })
        expect(retryRequest).not.toHaveBeenCalled()
    })

    it('onOpenTroubleshooting / onCloseTroubleshooting flips local state', () => {
        vi.mocked(useHardwareSigning).mockReturnValue(
            buildHardwareSigningResult({ status: 'error' }),
        )
        const { result } = renderHook(() => useLedgerSigningContent())
        expect(result.current.isTroubleshootingVisible).toBe(false)
        act(() => result.current.onOpenTroubleshooting())
        expect(result.current.isTroubleshootingVisible).toBe(true)
        act(() => result.current.onCloseTroubleshooting())
        expect(result.current.isTroubleshootingVisible).toBe(false)
    })

    describe('BLE-class error auto-troubleshooting', () => {
        const BLE_CLASS_KINDS = [
            'connection_failed',
            'connection_lost',
            'scan_timeout',
            'bluetooth_disabled',
            'bluetooth_permission',
        ] as const

        beforeEach(() => {
            vi.mocked(useSigningRequest).mockReturnValue({
                pendingSignRequests: [{ id: 'req-1' } as never],
                rejectRequest: vi.fn(),
                retryRequest: vi.fn(),
            } as never)
        })

        it.each(BLE_CLASS_KINDS)(
            'auto-opens the troubleshooting sheet for kind=%s',
            kind => {
                vi.mocked(useHardwareSigning).mockReturnValue(
                    buildHardwareSigningResult({
                        status: 'error',
                        error: { kind },
                    }),
                )
                const { result } = renderHook(() => useLedgerSigningContent())
                expect(result.current.isTroubleshootingVisible).toBe(true)
            },
        )

        it.each(BLE_CLASS_KINDS)(
            'hides the main overlay (isVisible=false) when the BLE-class error %s opens troubleshooting',
            kind => {
                vi.mocked(useHardwareSigning).mockReturnValue(
                    buildHardwareSigningResult({
                        status: 'error',
                        error: { kind },
                    }),
                )
                const { result } = renderHook(() => useLedgerSigningContent())
                expect(result.current.isVisible).toBe(false)
            },
        )

        it('does NOT auto-open troubleshooting for non-BLE errors', () => {
            vi.mocked(useHardwareSigning).mockReturnValue(
                buildHardwareSigningResult({
                    status: 'error',
                    error: { kind: 'user_rejected' },
                }),
            )
            const { result } = renderHook(() => useLedgerSigningContent())
            expect(result.current.isTroubleshootingVisible).toBe(false)
            expect(result.current.isVisible).toBe(true)
        })

        it('closing troubleshooting after a BLE-class auto-open rejects the request', () => {
            const rejectRequest = vi.fn()
            const dismiss = vi.fn(() => {
                // Simulate what dismiss() actually does: reset the store state AND
                // clear the error from the hardware signing hook (in production both
                // come from the same store; here they're mocked independently).
                useHardwareSigningStore.getState().resetState()
            })
            const activeRequest = { id: 'req-1' } as never
            vi.mocked(useSigningRequest).mockReturnValue({
                pendingSignRequests: [activeRequest],
                rejectRequest,
                retryRequest: vi.fn(),
            } as never)
            vi.mocked(useHardwareSigning).mockReturnValue(
                buildHardwareSigningResult({
                    status: 'error',
                    error: { kind: 'connection_failed' },
                    resolveActiveRequest: () => activeRequest,
                    dismiss,
                }),
            )
            const { result, rerender } = renderHook(() =>
                useLedgerSigningContent(),
            )
            act(() => {
                result.current.onCloseTroubleshooting()
            })
            expect(rejectRequest).toHaveBeenCalledWith(activeRequest)
            expect(dismiss).toHaveBeenCalledOnce()
            // After dismiss resets the store, re-render with no error to confirm the
            // sheet closes. In production dismiss() clears the signing store error
            // too; here we simulate that by updating the mock and rerendering.
            vi.mocked(useHardwareSigning).mockReturnValue(
                buildHardwareSigningResult({
                    isActive: false,
                    status: 'idle',
                    error: null,
                }),
            )
            rerender()
            expect(result.current.isTroubleshootingVisible).toBe(false)
        })

        it('closing troubleshooting after a MANUAL open (non-BLE error) only closes the sheet', () => {
            const rejectRequest = vi.fn()
            const dismiss = vi.fn()
            vi.mocked(useSigningRequest).mockReturnValue({
                pendingSignRequests: [{ id: 'req-1' } as never],
                rejectRequest,
                retryRequest: vi.fn(),
            } as never)
            vi.mocked(useHardwareSigning).mockReturnValue(
                buildHardwareSigningResult({
                    status: 'error',
                    error: { kind: 'user_rejected' },
                    dismiss,
                }),
            )
            const { result } = renderHook(() => useLedgerSigningContent())
            act(() => {
                result.current.onOpenTroubleshooting()
            })
            expect(result.current.isTroubleshootingVisible).toBe(true)
            act(() => {
                result.current.onCloseTroubleshooting()
            })
            expect(rejectRequest).not.toHaveBeenCalled()
            expect(dismiss).not.toHaveBeenCalled()
            expect(result.current.isTroubleshootingVisible).toBe(false)
        })
    })

    describe('BLE auto-open synchronous derivation (perf)', () => {
        it('isTroubleshootingVisible becomes true on the first render when a BLE-class error appears — no extra render cycle', () => {
            // Arrange: start with no error
            vi.mocked(useHardwareSigning).mockReturnValue(
                buildHardwareSigningResult({
                    isActive: true,
                    status: 'awaitingApproval',
                    error: null,
                }),
            )
            const { result, rerender } = renderHook(() =>
                useLedgerSigningContent(),
            )
            expect(result.current.isTroubleshootingVisible).toBe(false)

            // Act: simulate a BLE-class error arriving
            vi.mocked(useHardwareSigning).mockReturnValue(
                buildHardwareSigningResult({
                    isActive: true,
                    status: 'error',
                    error: { kind: 'connection_failed' },
                }),
            )

            // Count renders from this point to verify synchronous update
            let renderCount = 0
            const { result: result2 } = renderHook(() => {
                renderCount++
                return useLedgerSigningContent()
            })

            // Assert: isTroubleshootingVisible is true on the very first render
            // after the error — no second render needed (no useEffect flush)
            expect(renderCount).toBe(1)
            expect(result2.current.isTroubleshootingVisible).toBe(true)

            // Silence unused variable warning
            void rerender
        })
    })

    describe('cross-instance state sharing (regression)', () => {
        it('calling onOpenTroubleshooting in one instance is visible to a second concurrent instance', () => {
            vi.mocked(useHardwareSigning).mockReturnValue(
                buildHardwareSigningResult({
                    isActive: true,
                    status: 'error',
                    error: { kind: 'user_rejected' },
                }),
            )

            const { result: instanceA } = renderHook(() =>
                useLedgerSigningContent(),
            )
            const { result: instanceB } = renderHook(() =>
                useLedgerSigningContent(),
            )

            expect(instanceA.current.isTroubleshootingVisible).toBe(false)
            expect(instanceB.current.isTroubleshootingVisible).toBe(false)

            act(() => {
                instanceA.current.onOpenTroubleshooting()
            })

            // Both instances see the updated store state
            expect(instanceA.current.isTroubleshootingVisible).toBe(true)
            expect(instanceB.current.isTroubleshootingVisible).toBe(true)
        })
    })
})
