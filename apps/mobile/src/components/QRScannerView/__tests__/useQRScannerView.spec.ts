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
import { renderHook, act } from '@testing-library/react'
import { useQRScannerView } from '../useQRScannerView'

const mockHandleDeepLink = vi.fn()
const mockIsValidDeepLink = vi.fn(() => true)

vi.mock('react-native-vision-camera', () => ({
    useCameraDevice: vi.fn(() => ({ id: 'mock-device' })),
    useCameraPermission: () => ({
        hasPermission: true,
        requestPermission: vi.fn(),
    }),
}))

vi.mock('@hooks/useDeepLink', () => ({
    useDeepLink: vi.fn(() => ({
        handleDeepLink: mockHandleDeepLink,
        isValidDeepLink: mockIsValidDeepLink,
        parseDeeplink: vi.fn(() => ({ type: 'HOME' })),
    })),
}))

const VALID_ADDRESS =
    'VCMJKWOY5P5P7SKMZFFOCEROPJCZOTIJMNIYNUCKH7LRO45JMJP6UYBIJA'

describe('useQRScannerView', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIsValidDeepLink.mockReturnValue(true)
    })

    it('calls handleDeepLink when skipDeepLinkHandler is false', () => {
        const onSuccess = vi.fn()
        const { result } = renderHook(() =>
            useQRScannerView({
                isVisible: true,
                onSuccess,
                skipDeepLinkHandler: false,
            }),
        )
        result.current.onBarcodeScanned([{ rawValue: VALID_ADDRESS }])
        expect(mockHandleDeepLink).toHaveBeenCalledWith(
            VALID_ADDRESS,
            false,
            'qr',
            expect.any(Function),
            expect.any(Function),
            expect.any(Function),
        )
        expect(onSuccess).not.toHaveBeenCalled()
    })

    it('skips handleDeepLink and calls onSuccess directly when skipDeepLinkHandler is true', () => {
        const onSuccess = vi.fn()
        const { result } = renderHook(() =>
            useQRScannerView({
                isVisible: true,
                onSuccess,
                skipDeepLinkHandler: true,
            }),
        )
        result.current.onBarcodeScanned([{ rawValue: VALID_ADDRESS }])
        expect(mockHandleDeepLink).not.toHaveBeenCalled()
        expect(onSuccess).toHaveBeenCalledWith(
            VALID_ADDRESS,
            expect.any(Function),
        )
    })

    it('ignores re-entrant scans while one is already being handled', () => {
        const onSuccess = vi.fn()
        const { result } = renderHook(() =>
            useQRScannerView({
                isVisible: true,
                onSuccess,
                skipDeepLinkHandler: true,
            }),
        )
        result.current.onBarcodeScanned([{ rawValue: VALID_ADDRESS }])
        result.current.onBarcodeScanned([{ rawValue: VALID_ADDRESS }])
        expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    // The camera stills as soon as a code is accepted, so without this flag a
    // multi-second WalletConnect pairing looks like a hang (PERA-4748).
    describe('isHandling', () => {
        const renderScanner = (onSuccess = vi.fn()) =>
            renderHook(() =>
                useQRScannerView({
                    isVisible: true,
                    onSuccess,
                    skipDeepLinkHandler: false,
                }),
            )

        it('is false before a scan', () => {
            const { result } = renderScanner()
            expect(result.current.isHandling).toBe(false)
        })

        it('is true while the deeplink is in flight', () => {
            const { result } = renderScanner()
            act(() => {
                result.current.onBarcodeScanned([{ rawValue: VALID_ADDRESS }])
            })
            expect(result.current.isHandling).toBe(true)
        })

        it.each([
            ['failure', 3],
            ['success', 4],
            ['rejection', 5],
        ])(
            'clears on %s so the frame is never left dimmed',
            (_label, argIndex) => {
                const { result } = renderScanner()
                act(() => {
                    result.current.onBarcodeScanned([
                        { rawValue: VALID_ADDRESS },
                    ])
                })
                const callback = mockHandleDeepLink.mock.calls[0]?.[
                    argIndex
                ] as () => void
                act(() => callback())
                expect(result.current.isHandling).toBe(false)
            },
        )

        it('stays false on the skipDeepLinkHandler path, which is synchronous', () => {
            const { result } = renderHook(() =>
                useQRScannerView({
                    isVisible: true,
                    onSuccess: vi.fn(),
                    skipDeepLinkHandler: true,
                }),
            )
            act(() => {
                result.current.onBarcodeScanned([{ rawValue: VALID_ADDRESS }])
            })
            expect(result.current.isHandling).toBe(false)
        })
    })
})
