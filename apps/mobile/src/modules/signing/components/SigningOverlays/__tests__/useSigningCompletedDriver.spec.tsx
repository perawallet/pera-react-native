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
    signingEventBus,
    type SignRequest,
    type SourceType,
    type TransportResult,
} from '@perawallet/wallet-core-signing'
import { SEND_TRANSACTION_SOURCE } from '@perawallet/wallet-core-transactions'
import { useWalletConnectStore } from '@perawallet/wallet-core-walletconnect'
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
    transportId?: string
    url?: string
}

const buildRequest = (
    sourceType: SourceType,
    opts: BuildOpts = {},
): SignRequest =>
    ({
        id: opts.id ?? 'req-1',
        type: opts.type ?? 'transactions',
        transport: 'callback',
        transportId: opts.transportId,
        sourceType,
        sourceMetadata:
            opts.name || opts.url
                ? { name: opts.name, url: opts.url }
                : undefined,
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

    describe('return-to-dapp hand-off (PERA-4856)', () => {
        beforeEach(() => {
            useWalletConnectStore.getState().pruneDappOrigins([])
        })

        it('passes the session origin to the sheet for a browser-initiated WC session', () => {
            useWalletConnectStore.getState().setDappOrigin('wc-client-9', {
                source: 'external-browser',
                browserName: 'Chrome',
            })
            renderHook(() => useSigningCompletedDriver())

            publishCompleted(
                buildRequest('walletconnect', {
                    transportId: 'wc-client-9',
                    name: 'Browser dApp',
                    url: 'https://browser-dapp.example',
                }),
            )

            const contents = requestBottomSheetMock.mock.calls[0][0].contents
            expect(contents.props.returnToDapp).toEqual({
                browserName: 'Chrome',
                dappName: 'Browser dApp',
                dappIconUrl: undefined,
            })
        })

        it('passes no origin for a WC session that was not browser-initiated', () => {
            renderHook(() => useSigningCompletedDriver())

            publishCompleted(
                buildRequest('walletconnect', {
                    transportId: 'wc-client-9',
                    name: 'QR dApp',
                    url: 'https://qr-dapp.example',
                }),
            )

            const contents = requestBottomSheetMock.mock.calls[0][0].contents
            expect(contents.props.returnToDapp).toBeUndefined()
        })

        it('suppresses the sheet entirely for webview-bridge signing (the dApp is right behind it)', () => {
            renderHook(() => useSigningCompletedDriver())

            publishCompleted(
                buildRequest('webview', { transportId: 'wc-client-9' }),
            )

            expect(requestBottomSheetMock).not.toHaveBeenCalled()
        })

        it('suppresses the sheet for WC sessions paired inside the in-app browser', () => {
            useWalletConnectStore.getState().setDappOrigin('wc-client-9', {
                source: 'in-app',
            })
            renderHook(() => useSigningCompletedDriver())

            publishCompleted(
                buildRequest('walletconnect', { transportId: 'wc-client-9' }),
            )

            expect(requestBottomSheetMock).not.toHaveBeenCalled()
        })

        it('shows the sheet without a hand-off for qr-paired sessions', () => {
            useWalletConnectStore.getState().setDappOrigin('wc-client-9', {
                source: 'qr',
            })
            renderHook(() => useSigningCompletedDriver())

            publishCompleted(
                buildRequest('walletconnect', { transportId: 'wc-client-9' }),
            )

            const contents = requestBottomSheetMock.mock.calls[0][0].contents
            expect(contents.props.returnToDapp).toBeUndefined()
        })

        it('keeps the sheet for deeplink-sourced signing (no dApp behind it)', () => {
            renderHook(() => useSigningCompletedDriver())

            publishCompleted(buildRequest('deeplink'))

            expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)
        })
    })
})
