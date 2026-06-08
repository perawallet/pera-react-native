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
    signingEventBus,
    type SignRequest,
    type SourceType,
    type TransportResult,
} from '@perawallet/wallet-core-signing'
import { SEND_TRANSACTION_SOURCE } from '@perawallet/wallet-core-transactions'
import { useSigningCompletedDriver } from '../useSigningCompletedDriver'

const { requestBottomSheetMock } = vi.hoisted(() => ({
    requestBottomSheetMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: requestBottomSheetMock,
        dismiss: vi.fn(),
        requestByType: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (k: string) => k }),
}))

type BuildOpts = {
    type?: 'transactions' | 'arbitrary-data' | 'arc60'
    name?: string
    id?: string
}

const buildRequest = (
    sourceType: SourceType,
    opts: BuildOpts = {},
): SignRequest =>
    ({
        id: opts.id ?? 'req-1',
        type: opts.type ?? 'transactions',
        transport: 'callback',
        sourceType,
        sourceMetadata: opts.name ? { name: opts.name } : undefined,
    }) as unknown as SignRequest

const submittedResult = {
    type: 'submitted',
    txIds: ['tx-1'],
} as unknown as TransportResult

const publishCompleted = (
    request: SignRequest,
    result: TransportResult = submittedResult,
) => {
    act(() => {
        signingEventBus.publish({ type: 'completed', request, result })
    })
}

describe('useSigningCompletedDriver', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        signingEventBus.__resetForTests()
    })

    it('opens the completion sheet for external transaction requests', () => {
        renderHook(() => useSigningCompletedDriver())
        publishCompleted(buildRequest('walletconnect'))
        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)
    })

    it('does not open the sheet for the send-funds flow (owns a full-screen processing screen)', () => {
        renderHook(() => useSigningCompletedDriver())
        publishCompleted(
            buildRequest('local', { name: SEND_TRANSACTION_SOURCE.name }),
        )
        expect(requestBottomSheetMock).not.toHaveBeenCalled()
    })

    it('does not open the sheet for other internal flows (swap, opt-in/out, asset-inbox claim/reject)', () => {
        renderHook(() => useSigningCompletedDriver())
        publishCompleted(buildRequest('local', { name: 'asset-opt-in' }))
        expect(requestBottomSheetMock).not.toHaveBeenCalled()
    })

    it('does not open the sheet for arbitrary-data signing, even from an external source', () => {
        renderHook(() => useSigningCompletedDriver())
        publishCompleted(
            buildRequest('walletconnect', { type: 'arbitrary-data' }),
        )
        expect(requestBottomSheetMock).not.toHaveBeenCalled()
    })

    it('does not open the sheet for arc60 signing', () => {
        renderHook(() => useSigningCompletedDriver())
        publishCompleted(buildRequest('arc60', { type: 'arc60' }))
        expect(requestBottomSheetMock).not.toHaveBeenCalled()
    })

    it('does not open the sheet for multisig-cosign completions', () => {
        renderHook(() => useSigningCompletedDriver())
        publishCompleted(buildRequest('multisig-cosign'))
        expect(requestBottomSheetMock).not.toHaveBeenCalled()
    })

    it('does not open the sheet for proposed transport results', () => {
        renderHook(() => useSigningCompletedDriver())
        publishCompleted(buildRequest('walletconnect'), {
            type: 'proposed',
            signRequestId: 'sr-1',
            status: 'pending',
            sourceType: 'walletconnect',
        } as unknown as TransportResult)
        expect(requestBottomSheetMock).not.toHaveBeenCalled()
    })
})
