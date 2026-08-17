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
import { act, renderHook } from '@testing-library/react'
import {
    useHardwareSigningStore,
    useSigningPipeline,
    useSigningRequest,
    type HardwareChildSnapshot,
    type LedgerErrorPresetKind,
} from '@perawallet/wallet-core-signing'
import { useLedgerSigningContent } from '../useLedgerSigningContent'

vi.mock('@perawallet/wallet-core-signing', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-signing')>()
    return {
        ...actual,
        useSigningRequest: vi.fn(),
        useSigningPipeline: vi.fn(),
    }
})

type ChildSnapshotOverrides = {
    value?: 'error' | { active: 'searching' | 'awaiting_approval' | 'signing' }
    deviceName?: string | null
    currentTx?: number | null
    totalTxs?: number | null
    operation?: 'transaction' | 'data'
    errorKind?: LedgerErrorPresetKind | null
}

// Lightweight stand-in for the real HardwareChildSnapshot — only the surface
// our hook reads (matches + context) needs to be faithful.
const buildChildSnapshot = (
    overrides: ChildSnapshotOverrides = {},
): HardwareChildSnapshot => {
    const value = overrides.value ?? { active: 'awaiting_approval' }
    const matches = (target: unknown): boolean => {
        if (typeof target === 'string')
            return typeof value === 'string' && value === target
        if (typeof value === 'string') return false
        const targetObj = target as { active?: string }
        const valueObj = value as { active?: string }
        return targetObj.active === valueObj.active
    }
    return {
        value,
        matches,
        context: {
            deviceName: overrides.deviceName ?? 'Nano X',
            currentTx: overrides.currentTx ?? null,
            totalTxs: overrides.totalTxs ?? null,
            operation: overrides.operation ?? 'transaction',
            error: overrides.errorKind
                ? { kind: overrides.errorKind, cause: undefined }
                : null,
        },
    } as unknown as HardwareChildSnapshot
}

type PipelineMockOverrides = {
    snapshot?: HardwareChildSnapshot | null
    retryHardware?: () => void
    acknowledgeHardwareError?: () => void
}

const mockPipeline = (overrides: PipelineMockOverrides = {}) => {
    const snapshot =
        overrides.snapshot === undefined
            ? buildChildSnapshot()
            : overrides.snapshot
    vi.mocked(useSigningPipeline).mockReturnValue({
        resolved: snapshot
            ? {
                  activeChild: { kind: 'hardware', snapshot },
              }
            : { activeChild: null },
        retryHardware: overrides.retryHardware ?? vi.fn(),
        acknowledgeHardwareError: overrides.acknowledgeHardwareError ?? vi.fn(),
    } as never)
}

describe('useLedgerSigningContent', () => {
    beforeEach(() => {
        useHardwareSigningStore.getState().resetState()
        vi.mocked(useSigningRequest).mockReturnValue({
            currentRequest: undefined,
            pendingSignRequests: [],
            rejectRequest: vi.fn(),
            retryRequest: vi.fn(),
        } as never)
    })

    it('isVisible is false when no hardware child is active', () => {
        mockPipeline({ snapshot: null })
        const { result } = renderHook(() => useLedgerSigningContent())
        expect(result.current.isVisible).toBe(false)
        expect(result.current.status).toBe('idle')
    })

    it('isVisible is false during the silent searching phase', () => {
        mockPipeline({
            snapshot: buildChildSnapshot({ value: { active: 'searching' } }),
        })
        const { result } = renderHook(() => useLedgerSigningContent())
        expect(result.current.isVisible).toBe(false)
        expect(result.current.status).toBe('searching')
    })

    it('isVisible is true while awaiting approval', () => {
        mockPipeline({
            snapshot: buildChildSnapshot({
                value: { active: 'awaiting_approval' },
            }),
        })
        const { result } = renderHook(() => useLedgerSigningContent())
        expect(result.current.isVisible).toBe(true)
        expect(result.current.status).toBe('awaitingApproval')
    })

    it('isVisible is true while signing', () => {
        mockPipeline({
            snapshot: buildChildSnapshot({ value: { active: 'signing' } }),
        })
        const { result } = renderHook(() => useLedgerSigningContent())
        expect(result.current.isVisible).toBe(true)
        expect(result.current.status).toBe('signing')
    })

    it('surfaces device name, progress, and error from the child snapshot context', () => {
        mockPipeline({
            snapshot: buildChildSnapshot({
                value: 'error',
                deviceName: 'Nano S',
                currentTx: 2,
                totalTxs: 4,
                errorKind: 'app_not_open',
            }),
        })
        const { result } = renderHook(() => useLedgerSigningContent())
        expect(result.current.deviceName).toBe('Nano S')
        expect(result.current.currentTx).toBe(2)
        expect(result.current.totalTxs).toBe(4)
        expect(result.current.status).toBe('error')
        expect(result.current.error?.kind).toBe('app_not_open')
        expect(result.current.error?.isRetryable).toBe(true)
        expect(result.current.error?.isTroubleshootable).toBe(false)
    })

    it('onCancel sends ACKNOWLEDGE_HARDWARE_ERROR when the child is in error', () => {
        const acknowledgeHardwareError = vi.fn()
        const rejectRequest = vi.fn()
        vi.mocked(useSigningRequest).mockReturnValue({
            currentRequest: { id: 'req-1' },
            pendingSignRequests: [{ id: 'req-1' }],
            rejectRequest,
            retryRequest: vi.fn(),
        } as never)
        mockPipeline({
            snapshot: buildChildSnapshot({
                value: 'error',
                errorKind: 'app_not_open',
            }),
            acknowledgeHardwareError,
        })
        const { result } = renderHook(() => useLedgerSigningContent())
        act(() => {
            result.current.onCancel()
        })
        expect(acknowledgeHardwareError).toHaveBeenCalledOnce()
        expect(rejectRequest).not.toHaveBeenCalled()
    })

    it('onCancel rejects the current request when the child is mid-flow', () => {
        const acknowledgeHardwareError = vi.fn()
        const rejectRequest = vi.fn()
        const currentRequest = { id: 'req-1' }
        vi.mocked(useSigningRequest).mockReturnValue({
            currentRequest,
            pendingSignRequests: [currentRequest],
            rejectRequest,
            retryRequest: vi.fn(),
        } as never)
        mockPipeline({
            snapshot: buildChildSnapshot({
                value: { active: 'awaiting_approval' },
            }),
            acknowledgeHardwareError,
        })
        const { result } = renderHook(() => useLedgerSigningContent())
        act(() => {
            result.current.onCancel()
        })
        expect(rejectRequest).toHaveBeenCalledWith(currentRequest)
        expect(acknowledgeHardwareError).not.toHaveBeenCalled()
    })

    it('onRetry calls retryHardware for a retryable error', () => {
        const retryHardware = vi.fn()
        mockPipeline({
            snapshot: buildChildSnapshot({
                value: 'error',
                errorKind: 'app_not_open',
            }),
            retryHardware,
        })
        const { result } = renderHook(() => useLedgerSigningContent())
        act(() => {
            result.current.onRetry()
        })
        expect(retryHardware).toHaveBeenCalledOnce()
    })

    it('onRetry is a no-op when the error is not retryable', () => {
        const retryHardware = vi.fn()
        mockPipeline({
            snapshot: buildChildSnapshot({
                value: 'error',
                errorKind: 'address_mismatch',
            }),
            retryHardware,
        })
        const { result } = renderHook(() => useLedgerSigningContent())
        act(() => {
            result.current.onRetry()
        })
        expect(retryHardware).not.toHaveBeenCalled()
    })

    it('onOpenTroubleshooting / onCloseTroubleshooting flips the store flag', () => {
        mockPipeline({
            snapshot: buildChildSnapshot({
                value: 'error',
                errorKind: 'address_mismatch',
            }),
        })
        const { result } = renderHook(() => useLedgerSigningContent())
        expect(result.current.isTroubleshootingVisible).toBe(false)
        act(() => result.current.onOpenTroubleshooting())
        expect(result.current.isTroubleshootingVisible).toBe(true)
        act(() => result.current.onCloseTroubleshooting())
        expect(result.current.isTroubleshootingVisible).toBe(false)
    })

    describe('connection-class errors keep their own copy', () => {
        const CONNECTION_CLASS_KINDS: readonly LedgerErrorPresetKind[] = [
            'connection_failed',
            'connection_lost',
            'scan_timeout',
            'bluetooth_disabled',
            'bluetooth_permission',
            'device_not_found',
        ]

        it.each(CONNECTION_CLASS_KINDS)(
            'shows the error sheet for kind=%s instead of replacing it with troubleshooting',
            kind => {
                // The regression this guards: auto-opening the generic
                // checklist swallowed the specific reason (Bluetooth off,
                // device not found, link lost) that the taxonomy exists to
                // surface. Troubleshooting is now opt-in via the link.
                mockPipeline({
                    snapshot: buildChildSnapshot({
                        value: 'error',
                        errorKind: kind,
                    }),
                })
                const { result } = renderHook(() => useLedgerSigningContent())
                expect(result.current.isVisible).toBe(true)
                expect(result.current.isTroubleshootingVisible).toBe(false)
                expect(result.current.error?.kind).toBe(kind)
                expect(result.current.error?.isTroubleshootable).toBe(true)
            },
        )

        it('offers no troubleshooting link for an error whose copy is already the remedy', () => {
            mockPipeline({
                snapshot: buildChildSnapshot({
                    value: 'error',
                    errorKind: 'user_rejected',
                }),
            })
            const { result } = renderHook(() => useLedgerSigningContent())
            expect(result.current.isVisible).toBe(true)
            expect(result.current.error?.isTroubleshootable).toBe(false)
        })

        it('closing troubleshooting returns to the error sheet rather than cancelling', () => {
            const acknowledgeHardwareError = vi.fn()
            const rejectRequest = vi.fn()
            vi.mocked(useSigningRequest).mockReturnValue({
                currentRequest: { id: 'req-1' },
                pendingSignRequests: [{ id: 'req-1' }],
                rejectRequest,
                retryRequest: vi.fn(),
            } as never)
            mockPipeline({
                snapshot: buildChildSnapshot({
                    value: 'error',
                    errorKind: 'connection_failed',
                }),
                acknowledgeHardwareError,
            })
            const { result } = renderHook(() => useLedgerSigningContent())
            act(() => {
                result.current.onOpenTroubleshooting()
            })
            act(() => {
                result.current.onCloseTroubleshooting()
            })
            expect(result.current.isTroubleshootingVisible).toBe(false)
            expect(result.current.isVisible).toBe(true)
            expect(acknowledgeHardwareError).not.toHaveBeenCalled()
            expect(rejectRequest).not.toHaveBeenCalled()
        })

        it('closing troubleshooting after a MANUAL open only closes the sheet', () => {
            const acknowledgeHardwareError = vi.fn()
            const rejectRequest = vi.fn()
            vi.mocked(useSigningRequest).mockReturnValue({
                currentRequest: { id: 'req-1' },
                pendingSignRequests: [{ id: 'req-1' }],
                rejectRequest,
                retryRequest: vi.fn(),
            } as never)
            mockPipeline({
                snapshot: buildChildSnapshot({
                    value: 'error',
                    errorKind: 'user_rejected',
                }),
                acknowledgeHardwareError,
            })
            const { result } = renderHook(() => useLedgerSigningContent())
            act(() => {
                result.current.onOpenTroubleshooting()
            })
            expect(result.current.isTroubleshootingVisible).toBe(true)
            act(() => {
                result.current.onCloseTroubleshooting()
            })
            expect(acknowledgeHardwareError).not.toHaveBeenCalled()
            expect(rejectRequest).not.toHaveBeenCalled()
            expect(result.current.isTroubleshootingVisible).toBe(false)
        })
    })

    describe('cross-instance state sharing (regression)', () => {
        it('opening troubleshooting in one instance is visible to a second concurrent instance', () => {
            mockPipeline({
                snapshot: buildChildSnapshot({
                    value: 'error',
                    errorKind: 'user_rejected',
                }),
            })

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

            expect(instanceA.current.isTroubleshootingVisible).toBe(true)
            expect(instanceB.current.isTroubleshootingVisible).toBe(true)
        })
    })
})
