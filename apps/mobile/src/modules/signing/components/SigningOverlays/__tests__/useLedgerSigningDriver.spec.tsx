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
import { renderHook } from '@testing-library/react'
import {
    useHardwareSigningStore,
    useSigningPipeline,
    useSigningRequest,
    type HardwareChildSnapshot,
} from '@perawallet/wallet-core-signing'
import { useLedgerSigningDriver } from '../useLedgerSigningDriver'

const { requestBottomSheetMock, dismissMock } = vi.hoisted(() => ({
    requestBottomSheetMock: vi.fn().mockResolvedValue(undefined),
    dismissMock: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: requestBottomSheetMock,
        dismiss: dismissMock,
        requestByType: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (k: string) => k }),
}))

vi.mock('@perawallet/wallet-core-signing', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-signing')>()
    return {
        ...actual,
        useSigningRequest: vi.fn(),
        useSigningPipeline: vi.fn(),
    }
})

type ChildValue =
    | 'error'
    | { active: 'searching' | 'awaiting_approval' | 'signing' }

const buildChildSnapshot = (value: ChildValue): HardwareChildSnapshot => {
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
            deviceName: 'Nano X',
            currentTx: null,
            totalTxs: null,
            error: null,
        },
    } as unknown as HardwareChildSnapshot
}

const mockPipelineWithChild = (snapshot: HardwareChildSnapshot | null) => {
    vi.mocked(useSigningPipeline).mockReturnValue({
        resolved: snapshot
            ? { activeChild: { kind: 'hardware', snapshot } }
            : { activeChild: null },
        retryHardware: vi.fn(),
        acknowledgeHardwareError: vi.fn(),
    } as never)
}

const mockPendingRequests = (ids: string[]) => {
    vi.mocked(useSigningRequest).mockReturnValue({
        currentRequest: ids[0] ? { id: ids[0] } : undefined,
        pendingSignRequests: ids.map(id => ({ id })),
        rejectRequest: vi.fn(),
        retryRequest: vi.fn(),
    } as never)
}

describe('useLedgerSigningDriver', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useHardwareSigningStore.getState().resetState()
        vi.mocked(useSigningRequest).mockReturnValue({
            currentRequest: undefined,
            pendingSignRequests: [],
            rejectRequest: vi.fn(),
            retryRequest: vi.fn(),
        } as never)
    })

    it('opens the sheet when the hardware child enters awaiting_approval', () => {
        mockPendingRequests(['req-1'])
        mockPipelineWithChild(
            buildChildSnapshot({ active: 'awaiting_approval' }),
        )
        renderHook(() => useLedgerSigningDriver())
        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)
        expect(requestBottomSheetMock.mock.calls[0][0].id).toBe('req-1')
    })

    it('keeps the sheet closed during the silent BLE-scan phase (searching)', () => {
        mockPendingRequests(['req-1'])
        mockPipelineWithChild(buildChildSnapshot({ active: 'searching' }))
        renderHook(() => useLedgerSigningDriver())
        expect(requestBottomSheetMock).not.toHaveBeenCalled()
    })

    it('opens the sheet for the signing phase too', () => {
        mockPendingRequests(['req-1'])
        mockPipelineWithChild(buildChildSnapshot({ active: 'signing' }))
        renderHook(() => useLedgerSigningDriver())
        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)
    })

    it('dismisses the sheet when the hardware child tears down', () => {
        mockPendingRequests(['req-1'])
        mockPipelineWithChild(
            buildChildSnapshot({ active: 'awaiting_approval' }),
        )
        const { rerender } = renderHook(() => useLedgerSigningDriver())
        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)
        expect(dismissMock).not.toHaveBeenCalled()

        mockPipelineWithChild(null)
        rerender()
        expect(dismissMock).toHaveBeenCalledWith('req-1')
    })
})
