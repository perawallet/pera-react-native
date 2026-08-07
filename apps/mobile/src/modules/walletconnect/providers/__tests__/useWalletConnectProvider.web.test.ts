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

// A previous version of this test mocked the whole
// `@perawallet/wallet-core-walletconnect` module, which made it pass even
// after a reviewer reintroduced `useWalletConnect('mainnet' as never)` into
// the twin (vi.mock swaps the module wholesale, so the real binder effect
// never runs regardless of what the twin calls). Spy on the real export
// instead — `useWalletConnect` itself must never be invoked from this UI
// surface, since merely calling it registers a connector handler binder
// (see `packages/walletconnect/src/hooks/useWalletConnect.ts`) and would
// make this popup a second owner of whatever session's socket offscreen
// already owns.
const useWalletConnectSpy = vi.fn()

vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnect: (...args: unknown[]) => useWalletConnectSpy(...args),
}))

// The twin now subscribes to the offscreen error broadcast, which reaches for
// the ambient `chrome` global. Capture the handler so the toast behaviour can
// be driven directly.
const noticeHandler = vi.hoisted(() => ({
    current: null as null | ((notice: Record<string, unknown>) => void),
}))
const unsubscribeSpy = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    onWcErrorNotice: (handler: (notice: Record<string, unknown>) => void) => {
        noticeHandler.current = handler
        return unsubscribeSpy
    },
}))

const showToastSpy = vi.hoisted(() => vi.fn())
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: showToastSpy }),
}))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))
vi.mock('@components/QRScannerView', () => ({
    scannerNotifier: { current: null },
}))

describe('useWalletConnectProvider (web)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('never calls useWalletConnect', async () => {
        const { useWalletConnectProvider } =
            await import('../useWalletConnectProvider.web')

        renderHook(() => useWalletConnectProvider())

        expect(useWalletConnectSpy).not.toHaveBeenCalled()
    })

    it('returns an inert result with no pending request, no success request, and no connection error', async () => {
        const { useWalletConnectProvider } =
            await import('../useWalletConnectProvider.web')

        const { result } = renderHook(() => useWalletConnectProvider())

        expect(result.current.nextRequest).toBeUndefined()
        expect(result.current.successRequest).toBeNull()
        expect(result.current.connectionError).toBeNull()
    })

    it('exposes no-op handlers that never throw', async () => {
        const { useWalletConnectProvider } =
            await import('../useWalletConnectProvider.web')

        const { result } = renderHook(() => useWalletConnectProvider())

        expect(() =>
            result.current.handleConnectionError(new Error('unused')),
        ).not.toThrow()
        expect(() =>
            result.current.handleSuccess({
                clientId: 'client-1',
            } as never),
        ).not.toThrow()
        expect(useWalletConnectSpy).not.toHaveBeenCalled()
    })

    // Wrong-network, rejected and expired handshakes are raised by the
    // connector, which on web lives in offscreen — its store's
    // `connectionError` is not persisted, so this realm never saw them and
    // they produced no UI at all.
    describe('connector failures broadcast from offscreen', () => {
        it('renders one as an error toast', async () => {
            const { useWalletConnectProvider } =
                await import('../useWalletConnectProvider.web')
            renderHook(() => useWalletConnectProvider())

            noticeHandler.current?.({ message: 'Wrong network' })

            expect(showToastSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: 'Wrong network',
                    type: 'error',
                }),
                expect.anything(),
            )
        })

        // Native replaces the raw message with its own copy for this case;
        // the twin must not diverge on what the user reads.
        it('uses the dedicated copy for a fee-adjustment delivery failure', async () => {
            const { useWalletConnectProvider } =
                await import('../useWalletConnectProvider.web')
            renderHook(() => useWalletConnectProvider())

            noticeHandler.current?.({
                message: 'raw internal text',
                isFeeAdjustmentDeliveryError: true,
            })

            expect(showToastSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: 'walletconnect.request.quantum_fee_delivery_failed',
                }),
                expect.anything(),
            )
        })

        it('unsubscribes on unmount', async () => {
            const { useWalletConnectProvider } =
                await import('../useWalletConnectProvider.web')
            const { unmount } = renderHook(() => useWalletConnectProvider())

            unmount()

            expect(unsubscribeSpy).toHaveBeenCalled()
        })
    })
})
