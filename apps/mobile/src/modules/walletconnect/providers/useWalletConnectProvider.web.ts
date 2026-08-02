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

import { useEffect } from 'react'
import { onWcErrorNotice } from '@perawallet/wallet-extension-platform-chrome'
import { scannerNotifier } from '@components/QRScannerView'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import type { useWalletConnectProvider as useNativeWalletConnectProvider } from './useWalletConnectProvider'

/**
 * `ReturnType<>` over a type-only import of the native hook, rather than a
 * hand-declared type: `tsc` has no platform resolution (see the module doc
 * in `useWalletConnectPairing.web.ts`), so this specifier always resolves to
 * the real native file for type-checking purposes even though Metro resolves
 * the bare `./useWalletConnectProvider` import in `WalletConnectProvider.tsx`
 * to THIS file at bundle time. `import type` is erased before bundling, so
 * it pulls in zero runtime code (and, in particular, never triggers native's
 * own `useWalletConnect`/`ConnectionView` imports) while still failing the
 * build if this file's return value ever drifts from native's shape.
 */
type UseWalletConnectProviderResult = ReturnType<
    typeof useNativeWalletConnectProvider
>

/**
 * Web twin. Offscreen is the sole owner of WC connectors on web (see
 * `apps/browser/src/offscreen/walletconnect/wcHost.ts`), so nothing in this
 * UI realm ever binds WC v1 event handlers — which is also what makes this
 * hook's watched state permanently inert here:
 *
 * - `sessionRequests` (native's `nextRequest`) is populated only by
 *   `useWalletConnect`'s `session_request` handler, which never runs on
 *   web. A `wc-connect` handshake surviving offscreen's gate is instead
 *   answered by the service worker opening a dedicated approval window
 *   (`EnableRequestScreen`, via `apps/browser/src/background/
 *   walletconnect.ts`'s `installWcApprovalRouter`) — a real browser
 *   window, not a bottom sheet in this tree.
 * - `connectionError` is set only by that same disused handler set — in the
 *   OFFSCREEN realm, whose store this one never sees (`connectionError` is
 *   not persisted, so the cross-realm rehydrate doesn't carry it). Offscreen
 *   therefore forwards each one over the `wc-error-notice` broadcast, which
 *   this hook subscribes to below and renders exactly as native does.
 *
 * `WalletConnectProvider` is still mounted on web for `
 * WalletConnectErrorBoundary` — a real, WC-unrelated crash guard for the nav
 * tree — so this hook stays as a documented no-op rather than removing the
 * mount and losing that protection. Offscreen currently reports a pairing
 * failure only through the narrow `pair-outcome` broadcast a caller is
 * actively waiting on (`useWalletConnectPairing.web.ts`); there is no
 * general-purpose offscreen→UI error channel this hook could surface
 * `connectionError` from. If one is ever built, this is the file that grows
 * a body again.
 */
export const useWalletConnectProvider = (): UseWalletConnectProviderResult => {
    const { showToast } = useToast()
    const { t } = useLanguage()

    useEffect(
        () =>
            onWcErrorNotice(notice => {
                showToast(
                    {
                        title: t('walletconnect.request.error_sheet_title'),
                        body: notice.isFeeAdjustmentDeliveryError
                            ? t(
                                  'walletconnect.request.quantum_fee_delivery_failed',
                              )
                            : notice.message,
                        type: 'error',
                    },
                    // Route to the scanner's notifier when it's open, for the
                    // same reason native does: its Modal covers the root tree,
                    // so the global notifier would paint behind the camera.
                    { notifier: scannerNotifier.current ?? undefined },
                )
            }),
        [showToast, t],
    )

    // Still inert: the request queue and success sheet are driven by handlers
    // that only ever run where a connector lives, which on web is offscreen.
    return {
        nextRequest: undefined,
        successRequest: null,
        connectionError: null,
        handleConnectionError: () => {},
        handleSuccess: () => {},
    }
}
