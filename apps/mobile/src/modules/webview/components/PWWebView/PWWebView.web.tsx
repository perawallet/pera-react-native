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

// fallow-ignore-file re-export-cycle -- false positive: fallow's
// platform-suffix resolver matches the `./PWWebView` re-export below back to
// this same `.web.tsx` file instead of the intended `PWWebView.tsx` sibling
// (TypeScript itself resolves it correctly — `pnpm build` passes).

// Web replacement for PWWebView, since react-native-webview doesn't exist on
// web. Renders the URL in an iframe and rebuilds the bridge transport: the
// Discover content scripts install `peraMobileInterface` inside the iframe and
// relay over a chrome.runtime Port that createDiscoverBridgeHost accepts only
// for this mount's token and the Discover origin.
//
// The usePeraWebviewInterface registry handles every op unchanged. Only
// pushWebView is intercepted — dapps open in real tabs, where the injected
// ARC-0027 provider supplies connect/sign, so there's no nested viewer.
// walletConnect falls through to the registry, which pairs via the offscreen
// host; that approval opens as its own window, not a sheet in this tree.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { logger } from '@perawallet/wallet-core-shared'
import {
    createDiscoverBridgeHost,
    openExternalTab,
} from '@perawallet/wallet-extension-platform-chrome'
import { PWView } from '@components/core/PWView'
import { PWButton } from '@components/core/PWButton'
import { EmptyView } from '@components/EmptyView/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { useNetworkStatus } from '@modules/network'
import { usePeraWebviewInterface } from '../../hooks/usePeraWebviewInterface'
import { useNotifyWebViewOnContextChange } from '../../hooks/useNotifyWebViewOnContextChange'
import { useContextFingerprints } from '../../hooks/useContextFingerprints'
import {
    generateBridgeToken,
    hasValidBridgeToken,
    isSafeBrowserUrl,
    isTrustedWebviewOrigin,
} from '../../hooks/handlers'
import {
    getTrustedIframeOrigins,
    getTrustedIframeSourceBases,
} from '../../hooks/trusted-iframe-origins.web'
// asBridgeWebview/WebviewBridgeTransport/requireSecure are bound to the web
// transport (native handlers.ts binds its own requireSecure to
// injectJavaScript, not a Port) — imported with the explicit .web suffix so
// both Metro (redundantly) and vitest (which has no platform resolution for
// bare specifiers) land on the same file.
import {
    asBridgeWebview,
    requireSecure,
    type WebviewBridgeTransport,
} from '../../hooks/handlers.web'
import { toLoadableUrl } from './toLoadableUrl'
import { useStyles } from './styles'
// Same timeout the native load-state machine uses, so both platforms give up
// on a silent navigation after the same wait.
import { WEBVIEW_LOADING_TIMEOUT_MS } from './usePWWebViewLoadState'
import type { PWWebViewProps } from './PWWebView'

export type { PWWebViewProps } from './PWWebView'

const TOKEN_PARAM = 'peraBridgeToken' // = WEBVIEW_BRIDGE_TOKEN_PARAM (bridge-wire.ts)

// Bounds the disconnect → regenerate-token → reconnect → disconnect… cycle a
// crash-looping relay (or a permanently broken extension context) could
// otherwise drive forever. A burst of disconnects within the quiet window
// gets at most this many auto-reloads before giving up and leaving the
// iframe as-is; a tab-switch/manual remount is the recovery path from there.
const MAX_RAPID_RECONNECTS = 3
const DISCONNECT_QUIET_WINDOW_MS = 10_000

const IFrame = 'iframe' as unknown as React.ComponentType<{
    src: string
    sandbox?: string
    title: string
    style?: Record<string, string | number>
    // Coarse load signals — a cross-origin frame exposes nothing finer.
    onLoad?: () => void
    onError?: () => void
}>

export const PWWebView = ({
    url,
    enablePeraConnect,
    onClose,
    onBack,
    // customJavaScript is intentionally inert on web: the content-script
    // pattern (bidali-main.ts / discover-main.ts) owns provider installation
    // for both Discover and Bidali instead of an injected-JS channel, which
    // doesn't exist for a cross-origin iframe. Callers (e.g.
    // BidaliWebViewScreen) pass it unconditionally so native and web share a
    // single prop surface — accepted here only so destructuring the shared
    // PWWebViewProps type doesn't require a cast.
    customJavaScript: _customJavaScript,
    onCustomMessage,
    containerStyle,
    webviewRef,
}: PWWebViewProps) => {
    const styles = useStyles({ bottomInset: 0 })
    const { t } = useLanguage()

    // A cross-origin iframe reports only a coarse load/error signal — there is
    // no per-subresource `onError` the way react-native-webview gives native,
    // and no way to read the framed document's status. That is enough for the
    // thing that actually mattered: a Bidali load failure previously left a
    // blank panel with no explanation and no way back.
    //
    // `onError` on an iframe is unreliable across browsers for navigation
    // failures, so offline is inferred from the connectivity the app already
    // tracks rather than from the element.
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
        'loading',
    )
    // Bumping this remounts the iframe (via its `key`) to re-attempt the load.
    const [reloadNonce, setReloadNonce] = useState(0)
    const { hasInternet } = useNetworkStatus()
    const isOffline = !hasInternet

    const handleLoad = useCallback(() => setStatus('ready'), [])
    const handleError = useCallback(() => setStatus('error'), [])
    const handleRetry = useCallback(() => {
        setStatus('loading')
        setReloadNonce(nonce => nonce + 1)
    }, [])

    // Nothing fires when a navigation is simply never answered (blocked host,
    // dead network), so bound the wait — otherwise the spinner is the new
    // blank panel.
    useEffect(() => {
        if (status !== 'loading') return
        const timer = setTimeout(
            () => setStatus('error'),
            WEBVIEW_LOADING_TIMEOUT_MS,
        )
        return () => clearTimeout(timer)
    }, [status, reloadNonce])

    // Regenerated when the bridge host reports its port died mid-life
    // (extension reload, host disposal) so every future call wouldn't
    // otherwise silently vanish for the rest of the iframe's life — see the
    // token/host effect below. Assigning a fresh value remounts the iframe
    // (via its `key`) into a fresh page JS realm and stands up a fresh
    // host/port for it.
    const [bridgeToken, setBridgeToken] = useState(() => generateBridgeToken())

    const isMountedRef = useRef(true)
    useEffect(
        () => () => {
            isMountedRef.current = false
        },
        [],
    )

    // Consecutive-disconnect bookkeeping for the reload backoff below. Plain
    // refs (no timers) — nothing to clean up on unmount beyond isMountedRef.
    const disconnectCountRef = useRef(0)
    const lastDisconnectAtRef = useRef(0)

    const src = useMemo(() => {
        const loadable = new URL(toLoadableUrl(url))
        loadable.searchParams.set(TOKEN_PARAM, bridgeToken)
        return loadable.toString()
    }, [url, bridgeToken])

    // Structural trust: the bridge content scripts only run on a known,
    // configured mount origin (Discover or Bidali), and
    // createDiscoverBridgeHost verifies the browser-stamped
    // port.sender.origin — an off-origin navigation inside the iframe kills
    // the bridge rather than reaching the handlers. This flag mirrors
    // native's isSecure for the requireSecure gate. isTrustedWebviewOrigin
    // compares by origin, so the pre-redirect configured bases (not the
    // post-redirect giftcards twin — the mounted `url` never becomes that)
    // are the right source list here.
    const isSecure = isTrustedWebviewOrigin(url, getTrustedIframeSourceBases())

    // The bridge-host trust set for this mount: empty for any URL that isn't
    // a known surface, which below skips host creation entirely rather than
    // standing up a host nothing could ever authenticate against.
    const trustedOrigins = useMemo(() => getTrustedIframeOrigins(url), [url])

    const hostRef = useRef<ReturnType<typeof createDiscoverBridgeHost> | null>(
        null,
    )
    const transport = useMemo<WebviewBridgeTransport>(
        () => ({ postToWebview: data => hostRef.current?.post(data) }),
        [],
    )
    const bridgeWebview = useMemo(() => asBridgeWebview(transport), [transport])
    const bridgeWebviewRef = useRef(bridgeWebview)

    // Populates the caller-supplied webviewRef (native fills it with the
    // real WebView instance) with this mount's transport-backed twin, so a
    // hook like useBidaliTransport can reach the SAME ref on both platforms
    // — its web sender (bidali-events.web.ts) recovers the transport back
    // out via asBridgeTransport. Nulled on unmount so a stale twin never
    // outlives this mount.
    useEffect(() => {
        if (!webviewRef) return undefined
        webviewRef.current = bridgeWebview
        return () => {
            webviewRef.current = null
        }
    }, [webviewRef, bridgeWebview])

    const mobileInterface = usePeraWebviewInterface(
        bridgeWebview,
        isSecure,
        url,
        onClose,
        onBack,
    )
    const contextFingerprints = useContextFingerprints()
    useNotifyWebViewOnContextChange(
        bridgeWebviewRef,
        enablePeraConnect ? contextFingerprints : undefined,
        isSecure,
    )

    // Mirror native handleEvent's dispatch order (PWWebView.tsx:173-215),
    // with the pushWebView web op intercept between token validation and dispatch.
    const handleBridgeMessage = (data: unknown): void => {
        if (onCustomMessage) {
            onCustomMessage(data)
            return
        }
        if (!enablePeraConnect) return
        if (!hasValidBridgeToken(data, bridgeToken)) return
        const messages = Array.isArray(data) ? data : [data]
        for (const message of messages) {
            const { method, params } = message as {
                method?: string
                params?: Record<string, unknown>
            }
            if (method === 'pushWebView') {
                // Every other privileged op runs through requireSecure inside
                // usePeraWebviewInterface — this web-only intercept must too,
                // rather than trusting the token check alone, so an insecure
                // connection gets the standard Unauthorized envelope instead
                // of a silent tab-open.
                requireSecure(
                    isSecure,
                    {
                        operation: 'pushWebView',
                        messageId: (message as { id?: string }).id ?? '',
                        sourceUrl: url,
                        webview: bridgeWebview,
                    },
                    () => {
                        const targetUrl = params?.url
                        if (
                            typeof targetUrl === 'string' &&
                            isSafeBrowserUrl(targetUrl)
                        ) {
                            openExternalTab(targetUrl)
                        }
                    },
                )
                continue
            }
            // The iframe's origin is fixed for the mount, so there is no
            // per-message race to resolve here.
            mobileInterface.handleMessage(
                message as Parameters<typeof mobileInterface.handleMessage>[0],
                { securedConnection: isSecure, sourceUrl: url },
            )
        }
    }
    const handleBridgeMessageRef = useRef(handleBridgeMessage)
    handleBridgeMessageRef.current = handleBridgeMessage

    useEffect(() => {
        // Untrusted mount (unrecognized URL): render the iframe with no
        // bridge at all rather than a host that could never authenticate a
        // port against an empty trust set.
        if (trustedOrigins.length === 0) return undefined

        const host = createDiscoverBridgeHost({
            token: bridgeToken,
            trustedOrigins,
            onMessage: data => handleBridgeMessageRef.current(data),
            onDisconnect: () => {
                if (!isMountedRef.current) return

                const now = Date.now()
                if (
                    now - lastDisconnectAtRef.current >
                    DISCONNECT_QUIET_WINDOW_MS
                ) {
                    disconnectCountRef.current = 0
                }
                lastDisconnectAtRef.current = now
                disconnectCountRef.current += 1

                if (disconnectCountRef.current > MAX_RAPID_RECONNECTS) {
                    logger.warn(
                        'PWWebView.web: bridge port disconnect-looped — giving up on auto-reload',
                        { consecutiveDisconnects: disconnectCountRef.current },
                    )
                    return
                }

                setBridgeToken(generateBridgeToken())
            },
        })
        hostRef.current = host
        return () => {
            hostRef.current = null
            host.dispose()
        }
    }, [bridgeToken, trustedOrigins])

    return (
        <PWView style={[styles.flex, containerStyle]}>
            <IFrame
                key={`${bridgeToken}:${reloadNonce}`}
                src={src}
                sandbox='allow-same-origin allow-scripts allow-forms allow-popups'
                title='pera-webview'
                onLoad={handleLoad}
                onError={handleError}
                // Raw DOM element rendered via react-dom, not an RN View:
                // makeStyles produces RN stylesheet ids that a host
                // <iframe> can't consume.
                // oxlint-disable-next-line react-native/no-inline-styles
                style={{ border: 0, width: '100%', height: '100%', flex: 1 }}
            />
            {/* Overlays rather than replacements: swapping the iframe out on
                failure would discard its bridge Port and force a full
                re-handshake on retry. */}
            {status === 'loading' && (
                <PWView
                    style={styles.absoluteFill}
                    testID='pw-webview-loading'
                >
                    <EmptyView
                        body=''
                        isLoading
                    />
                </PWView>
            )}
            {status === 'error' && (
                <PWView
                    style={styles.absoluteFill}
                    testID={
                        isOffline ? 'pw-webview-offline' : 'pw-webview-timeout'
                    }
                >
                    <EmptyView
                        title={t(
                            isOffline
                                ? 'common.webview.offline_title'
                                : 'common.webview.failed_title',
                        )}
                        body={t(
                            isOffline
                                ? 'common.webview.offline_body'
                                : 'common.webview.failed_body',
                        )}
                        button={
                            <PWButton
                                title={t('common.webview.reload')}
                                onPress={handleRetry}
                                variant='primary'
                            />
                        }
                    />
                </PWView>
            )}
        </PWView>
    )
}
