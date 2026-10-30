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

import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
    WebView,
    type WebViewMessageEvent,
    type WebViewProps,
} from 'react-native-webview'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@rneui/themed'
import type {
    WebViewErrorEvent,
    WebViewHttpErrorEvent,
    WebViewNativeEvent,
    WebViewNavigationEvent,
} from 'react-native-webview/lib/WebViewTypes'
import {
    baseJS,
    peraConnectJS,
    peraMobileInterfaceJS,
} from './injected-scripts'
import { useStyles } from './styles'
import {
    useContextFingerprints,
    usePeraWebviewInterface,
} from '@modules/webview/hooks'
import {
    generateBridgeToken,
    hasValidBridgeToken,
    isTrustedWebviewOrigin,
    toValidatedBrowserUrl,
} from '@modules/webview/hooks/handlers'
import { useNotifyWebViewOnContextChange } from '@modules/webview/hooks/useNotifyWebViewOnContextChange'
import {
    joinWebViewScripts,
    webViewScript,
    type WebViewScript,
} from '../../utils/webViewScript'
import { useWebViewNavigationGuard } from './useWebViewNavigationGuard'
import { useWebViewMessageSecurity } from './useWebViewMessageSecurity'
import { usePWWebViewLoadState } from './usePWWebViewLoadState'
import { EmptyView } from '@components/EmptyView'
import { PWView, PWButton } from '@components/core'
import { LoadingView } from '@components/LoadingView'
import {
    logger,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { toLoadableUrl } from './toLoadableUrl'
import { getWebViewUserAgent } from './getWebViewUserAgent'
import { HARDENED_WEBVIEW_PROPS } from './hardenedWebViewProps'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useLanguage } from '@hooks/useLanguage'
import { useWebViewStore, type WebViewFavorite } from '../../hooks'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'
import { config } from '@perawallet/wallet-core-config'

export type PWWebViewProps = {
    url: string
    enablePeraConnect: boolean
    requestId?: string
    showControls?: boolean
    // Gates the bottom back/forward/home bar independently of showControls (which
    // also drives the top close/reload bar). Defaults to true; set false for
    // single-page-app hosts (e.g. Bidali) where the WebView history-based
    // navigation the bar relies on never tracks in-app routing.
    showFooterBar?: boolean
    // For a host WebView that renders no controls of its own: open navigations
    // that leave `url`'s origin in the in-app browser (which has back/close)
    // instead of loading them in place, where the user would be stranded.
    openExternalLinksInBrowser?: boolean
    onClose?: () => void
    onBack?: () => void
    inBottomSheet?: boolean
    customJavaScript?: WebViewScript
    onCustomMessage?: (data: unknown) => void
    webviewRef?: React.RefObject<Nullable<WebView>>
    favorite?: WebViewFavorite
} & WebViewProps

const updateTheme = (mode: 'light' | 'dark'): WebViewScript =>
    webViewScript`updateTheme?.(${mode === 'dark' ? 'dark-theme' : 'light-theme'});`

export type UsePWWebViewResult = {
    title: string
    committedUrl: string
    onCloseRequested: () => void
    reload: () => void
    loadState: ReturnType<typeof usePWWebViewLoadState>
    renderWebView: () => React.ReactElement
    showControls: boolean
    showFooterBar: boolean
    favorite: Optional<WebViewFavorite>
    webview: React.RefObject<Nullable<WebView>>
    homeUrl: string
    navigationState: Optional<WebViewNativeEvent>
    bottomInset: number
}

export const usePWWebView = (props: PWWebViewProps): UsePWWebViewResult => {
    const {
        url,
        enablePeraConnect,
        requestId,
        showControls = false,
        showFooterBar = true,
        openExternalLinksInBrowser = false,
        onClose,
        onBack,
        inBottomSheet = false,
        customJavaScript,
        onCustomMessage,
        webviewRef,
        favorite,
        ...rest
    } = props
    const insets = useSafeAreaInsets()
    // A bottom sheet supplies no bottom inset of its own, so the footer must
    // clear the home indicator / system nav bar itself. Outside a sheet the
    // host screen handles insets, so keep it 0 to avoid double-insetting.
    const footerBottomInset = inBottomSheet ? insets.bottom : 0
    const styles = useStyles({ bottomInset: footerBottomInset })
    const { theme } = useTheme()
    const removeWebView = useWebViewStore(state => state.removeWebView)
    const pushWebView = useWebViewStore(state => state.pushWebView)
    const internalRef = useRef<WebView>(null)
    const webview = webviewRef ?? internalRef
    // Per-mount secret stamped onto bridge messages by the main-frame-only
    // injected script; native drops messages without it (subframe-forged).
    const bridgeToken = useRef(generateBridgeToken()).current
    const [title, setTitle] = useState('')
    const [navigationState, setNavigationState] = useState<WebViewNativeEvent>()
    const isDarkMode = useIsDarkMode()
    const { t } = useLanguage()
    const contextFingerprints = useContextFingerprints()

    // Normalize before loading: a scheme-less url (e.g. a bare host typed into
    // the Discover URL bar) is otherwise resolved by WKWebView as a bundle-
    // relative path and never loads. Trust/origin checks below still run on the
    // live navigation url, so this only affects the initial load target.
    const loadableUrl = toLoadableUrl(url)

    // Re-evaluated on every navigation event below — the bridge must downgrade
    // to untrusted as soon as the WebView leaves the trusted base origin
    // (redirect, link click, JS-driven navigation, opened iframe top-nav).
    // Updated eagerly (at load START), which is the fail-safe direction for a
    // trust decision: we distrust a target before we've committed to it.
    const [currentUrl, setCurrentUrl] = useState(url)

    // What the title bar shows. Deliberately NOT the eager value: a navigation
    // that never commits (204, Content-Disposition: attachment, blocked load)
    // leaves the user on the previous page, and an eager label would name the
    // target — the same frozen/wrong-host spoof this ticket fixes, inverted. So
    // the label follows committed navigations only, like a browser URL bar.
    const [committedUrl, setCommittedUrl] = useState(url)

    const isSecure = useMemo(
        () => isTrustedWebviewOrigin(currentUrl, [config.discoverBaseUrl]),
        [currentUrl],
    )

    const { trackNavigation, resolveMessageSecurity } =
        useWebViewMessageSecurity(loadableUrl)

    useNotifyWebViewOnContextChange(
        webview,
        enablePeraConnect ? contextFingerprints : undefined,
        isSecure,
    )

    const provider = usePeraProvider()
    const deviceInfo = provider.deviceInfo

    // Append the Pera identifier to the WebView's default browser UA rather
    // than replacing it: a bare non-browser UA (no Mozilla token) makes some
    // dApp CDNs/bot filters serve 404. The API User-Agent header
    // (useAppBootstrap) is separate and unaffected. Trust is decided once from
    // the initial load target, not per navigation: WKWebView reads
    // applicationNameForUserAgent only at WebView creation, so it cannot
    // follow an in-place navigation across the trust boundary (dapps opened
    // from Discover get their own PWWebView, so they load with the coarse UA).
    const applicationNameForUserAgent = useMemo(
        () =>
            getWebViewUserAgent(
                deviceInfo,
                isTrustedWebviewOrigin(loadableUrl, [config.discoverBaseUrl]),
            ),
        [deviceInfo, loadableUrl],
    )

    const onCloseRequested = useCallback(() => {
        if (!requestId) {
            onClose?.()
            return
        }
        removeWebView(requestId)
    }, [onClose, requestId, removeWebView])

    const mobileInterface = usePeraWebviewInterface(
        webview.current,
        isSecure,
        currentUrl,
        onCloseRequested,
        onBack,
    )

    const externalNavigation = useMemo(
        () =>
            openExternalLinksInBrowser
                ? {
                      hostUrl: loadableUrl,
                      onExternalNavigation: (target: string) => {
                          const url = toValidatedBrowserUrl(target)
                          if (url) pushWebView({ url })
                      },
                  }
                : undefined,
        [openExternalLinksInBrowser, loadableUrl, pushWebView],
    )

    const { onShouldStartLoadWithRequest } = useWebViewNavigationGuard({
        isTrustedOrigin: isSecure,
        pageUrl: currentUrl,
        webviewRef: webview,
        externalNavigation,
    })

    const handleEvent = useCallback(
        (event: WebViewMessageEvent) => {
            const dataString = event.nativeEvent.data
            if (!dataString) {
                return
            }

            let data: unknown
            try {
                data = JSON.parse(dataString)
            } catch {
                return
            }

            if (onCustomMessage) {
                onCustomMessage(data)
                return
            }

            if (!enablePeraConnect) {
                return
            }

            // Main-frame-only gate: the bridge API is injected into the main
            // frame only and stamps each message with this webview's token. A
            // message lacking the matching token originated from a subframe
            // (or was forged) and must not reach the bridge.
            if (!hasValidBridgeToken(data, bridgeToken)) {
                logger.warn(
                    'WebView: dropped bridge message with missing/invalid token',
                )
                return
            }

            logger.debug('WebView: Received onMessage event', {
                data,
            })
            // Trust is decided against this message's own originating URL —
            // never the React-state snapshot, which a message racing a
            // navigation would beat to the update.
            mobileInterface.handleMessage(
                data as Parameters<typeof mobileInterface.handleMessage>[0],
                resolveMessageSecurity(event),
            )
        },
        [
            onCustomMessage,
            enablePeraConnect,
            mobileInterface,
            bridgeToken,
            resolveMessageSecurity,
        ],
    )

    const navigationStateChange = useCallback(
        (navState: WebViewNativeEvent) => {
            logger.debug('WebView: Navigation state change', { navState })
            setNavigationState(navState)
            // navState.url reflects the page the WebView is actually showing
            // (after redirects, link clicks, JS-driven nav). Drive isSecure
            // off of that so a navigation away from a trusted origin
            // immediately downgrades the bridge to untrusted.
            if (navState.url) {
                trackNavigation(navState.url)
                setCurrentUrl(navState.url)
                // `loading: false` marks a committed navigation — including
                // same-document ones (hash/pushState), which never "load".
                if (!navState.loading) {
                    setCommittedUrl(navState.url)
                }
            }
        },
        [trackNavigation],
    )

    const reload = useCallback(() => {
        webview.current?.reload()
        // webview is a ref (stable); a ref is not a valid dependency.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const loadState = usePWWebViewLoadState({ onReload: reload })

    const verifyLoad = useCallback((event: WebViewNavigationEvent) => {
        logger.debug('WebView: Loading', {
            url: event.nativeEvent.url,
            isSecure,
        })
        loadState.handleLoadStart()
        // isSecure is only debug-logged here; loadState handlers are
        // stable useCallbacks.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const loadCompleted = useCallback((event: WebViewNavigationEvent) => {
        logger.debug('WebView: Title', { title: event.nativeEvent.title })
        setTitle(event.nativeEvent.title)
        loadState.handleLoadEnd()
        loadState.markDocumentLoaded()
        // loadState handlers are stable useCallbacks.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Load failures surface through the in-view error/offline pages, not
    // toasts: `onError` fires PER FAILED SUBRESOURCE, so an offline page
    // load used to storm the global notifier with hardcoded-English
    // "Failed to load resource" toasts carrying raw URLs.
    const handleLoadError = useCallback(
        (event: WebViewErrorEvent) => {
            loadState.handleLoadEnd()
            logger.warn('WebView: load error', {
                url: event.nativeEvent.url,
                code: event.nativeEvent.code,
                description: event.nativeEvent.description,
            })
        },
        // loadState handlers are stable useCallbacks.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    )

    const handleHttpError = useCallback((event: WebViewHttpErrorEvent) => {
        logger.warn('WebView: http error', {
            url: event.nativeEvent.url,
            statusCode: event.nativeEvent.statusCode,
            description: event.nativeEvent.description,
        })
    }, [])

    // Installed before the page runs any script: @perawallet/connect calls
    // window.open('perawallet-wc://…') on connect, possibly before document-end
    // injection, and WKWebView drops it unless the hook is in place. Interface
    // before connect: peraConnectJS's processModals() needs window.peraRPC.
    // `true;` keeps iOS from choking on a non-serializable eval result.
    // Undefined, never '', without Pera Connect: iOS would install an empty
    // user script.
    const preLoadJS = useMemo(
        () =>
            enablePeraConnect
                ? joinWebViewScripts(
                      peraMobileInterfaceJS(bridgeToken),
                      peraConnectJS,
                      webViewScript`true;`,
                  )
                : undefined,
        [enablePeraConnect, bridgeToken],
    )

    // The connect/interface scripts run again at document end because
    // before-content-loaded injection is unreliable on some Android versions;
    // their idempotency guards make the second pass a no-op. baseJS,
    // customJavaScript and updateTheme need the DOM, so they run here only.
    const jsToLoad = useMemo(
        () =>
            joinWebViewScripts(
                baseJS,
                enablePeraConnect
                    ? peraMobileInterfaceJS(bridgeToken)
                    : undefined,
                enablePeraConnect ? peraConnectJS : undefined,
                customJavaScript,
                updateTheme(theme.mode),
            ),
        [enablePeraConnect, customJavaScript, theme.mode, bridgeToken],
    )

    const renderWebView = useCallback(() => {
        return (
            <WebView
                ref={webview}
                // Safe defaults a caller may still override: third-party
                // payment pages (Bidali, onramp) can need cookies or a mixed
                // content mode to complete a redirect/3DS handoff.
                thirdPartyCookiesEnabled={false}
                mixedContentMode='never'
                {...rest}
                // oxlint-disable-next-line pera/no-unvalidated-open-url -- the url prop is checked at each <PWWebView> by this rule
                source={{
                    uri: loadableUrl,
                }}
                // Route EVERY scheme through onShouldStartLoadWithRequest — the
                // default http(s) whitelist hands custom-scheme URLs straight to
                // the OS before the guard runs, bypassing the origin check. With
                // '*' the guard is the sole decision point.
                // oxlint-disable-next-line pera/no-unvalidated-open-url -- the navigation guard decides every scheme (see above)
                originWhitelist={['*']}
                style={styles.webview}
                renderLoading={() => (
                    <PWView style={styles.absoluteFill}>
                        <LoadingView
                            variant='circle'
                            size='lg'
                        />
                    </PWView>
                )}
                renderError={() => {
                    return (
                        <PWView style={styles.absoluteFill}>
                            <EmptyView
                                title={t('common.webview.failed_title')}
                                body={t('common.webview.failed_body')}
                                button={
                                    <PWButton
                                        title={t('common.webview.reload')}
                                        onPress={reload}
                                        variant='primary'
                                    />
                                }
                            />
                        </PWView>
                    )
                }}
                containerStyle={styles.container}
                startInLoadingState
                onMessage={handleEvent}
                webviewDebuggingEnabled={config.debugEnabled}
                pullToRefreshEnabled={true}
                injectedJavaScript={jsToLoad}
                // Deliberately NOT setting
                // injectedJavaScriptBeforeContentLoadedForMainFrameOnly: its
                // `true` default is load-bearing for the bridge-token model
                // (the token must stay unreadable from subframes).
                injectedJavaScriptBeforeContentLoaded={preLoadJS}
                setSupportMultipleWindows={false}
                {...HARDENED_WEBVIEW_PROPS}
                applicationNameForUserAgent={applicationNameForUserAgent}
                forceDarkOn={isDarkMode}
                onLoadStart={verifyLoad}
                onLoad={loadCompleted}
                onError={handleLoadError}
                onHttpError={handleHttpError}
                dataDetectorTypes={[]}
                onNavigationStateChange={navigationStateChange}
                onShouldStartLoadWithRequest={
                    rest.onShouldStartLoadWithRequest ??
                    onShouldStartLoadWithRequest
                }
                nestedScrollEnabled
            />
        )
    }, [
        reload,
        handleEvent,
        verifyLoad,
        loadCompleted,
        handleLoadError,
        handleHttpError,
        navigationStateChange,
        onShouldStartLoadWithRequest,
        isDarkMode,
        applicationNameForUserAgent,
        jsToLoad,
        preLoadJS,
        rest,
        styles.container,
        styles.webview,
        webview,
        styles.absoluteFill,
        t,
        loadableUrl,
    ])

    return {
        title,
        committedUrl,
        onCloseRequested,
        reload,
        loadState,
        renderWebView,
        showControls,
        showFooterBar,
        favorite,
        webview,
        homeUrl: loadableUrl,
        navigationState,
        bottomInset: footerBottomInset,
    }
}
