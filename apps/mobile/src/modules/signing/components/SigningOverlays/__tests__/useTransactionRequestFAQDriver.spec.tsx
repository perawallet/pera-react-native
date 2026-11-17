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
import { renderHook } from '@testing-library/react'
import {
    isSignRequestAwaitingPreflight,
    useSigningRequest,
    type SignRequest,
    type SourceType,
} from '@perawallet/wallet-core-signing'
import { useTransactionRequestFAQDriver } from '../useTransactionRequestFAQDriver'

const { requestBottomSheetMock, preferences } = vi.hoisted(() => ({
    requestBottomSheetMock: vi.fn(() => new Promise(() => {})),
    preferences: { hasSeenFAQ: false },
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: requestBottomSheetMock,
        dismiss: vi.fn(),
        requestByType: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('../../TransactionRequestFAQContent', () => ({
    TransactionRequestFAQContent: () => null,
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: () => ({
        getPreference: () => preferences.hasSeenFAQ,
        setPreference: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-signing', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-signing')>()
    return {
        ...actual,
        useSigningRequest: vi.fn(),
        isSignRequestAwaitingPreflight: vi.fn(() => false),
    }
})

const wcRequest = {
    id: 'wc-request',
    type: 'transactions',
    transport: 'callback',
    sourceType: 'walletconnect',
} as unknown as SignRequest

const DAPP_SOURCES = [
    'walletconnect',
    'webview',
    'deeplink',
    'injected',
] as const satisfies readonly SourceType[]

const WALLET_OWN_SOURCES = [
    'replacement',
    'card',
    'gift-card',
    'approval-revoke',
    'multisig-cosign',
    'local',
] as const satisfies readonly SourceType[]

const requestFrom = (sourceType: SourceType): SignRequest =>
    ({ ...wcRequest, id: `${sourceType}-request`, sourceType }) as SignRequest

const mockQueue = (pending: SignRequest[]) => {
    vi.mocked(useSigningRequest).mockReturnValue({
        pendingSignRequests: pending,
    } as unknown as ReturnType<typeof useSigningRequest>)
}

describe('useTransactionRequestFAQDriver', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(isSignRequestAwaitingPreflight).mockReturnValue(false)
        preferences.hasSeenFAQ = false
    })

    it('opens the FAQ for the first transaction request on a device that has not seen it', () => {
        mockQueue([wcRequest])

        renderHook(() => useTransactionRequestFAQDriver())

        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)
    })

    it('holds the FAQ back while the request is still in its chain check', () => {
        // Opened now, the review sheet would later stack over it, and a
        // request the check declines would leave the FAQ explaining nothing.
        vi.mocked(isSignRequestAwaitingPreflight).mockReturnValue(true)
        mockQueue([wcRequest])

        renderHook(() => useTransactionRequestFAQDriver())

        expect(requestBottomSheetMock).not.toHaveBeenCalled()
    })

    it.each(DAPP_SOURCES)(
        'opens the FAQ for the first %s request',
        sourceType => {
            mockQueue([requestFrom(sourceType)])

            renderHook(() => useTransactionRequestFAQDriver())

            expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)
        },
    )

    it.each(WALLET_OWN_SOURCES)(
        'keeps the FAQ unseen for a first %s request, which the wallet starts itself',
        sourceType => {
            mockQueue([requestFrom(sourceType)])

            renderHook(() => useTransactionRequestFAQDriver())

            expect(requestBottomSheetMock).not.toHaveBeenCalled()
        },
    )

    it('keeps the FAQ for later while a dApp request waits behind a review the wallet started', () => {
        mockQueue([requestFrom('replacement'), requestFrom('walletconnect')])

        renderHook(() => useTransactionRequestFAQDriver())

        expect(requestBottomSheetMock).not.toHaveBeenCalled()
    })

    it('never opens the FAQ again once it has been seen', () => {
        preferences.hasSeenFAQ = true
        mockQueue([wcRequest])

        renderHook(() => useTransactionRequestFAQDriver())

        expect(requestBottomSheetMock).not.toHaveBeenCalled()
    })
})
