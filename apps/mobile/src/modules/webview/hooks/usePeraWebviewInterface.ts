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

/* eslint-disable max-lines */

import type WebView from 'react-native-webview'
import { useErrorToast } from '@hooks/useErrorToast'
import { useToast } from '@hooks/useToast'
import { Linking } from 'react-native'
import { useDeviceID } from '@perawallet/wallet-core-device'
import {
    type Arc0001SignTxnsOpts,
    type Arc0001WalletTransaction,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import {
    AccountTypes,
    canSignArbitraryData,
    canSignArc60,
    canSignWith,
    isRekeyedAccount,
    useAllAccounts,
    useSigningAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { useCallback, useEffect, useRef } from 'react'
import { useWebView } from './useWebViewStore'
import { useLanguage } from '@hooks/useLanguage'
import { resolveWebviewLanguage } from './webviewLanguage'
import {
    type Arc60SignRequest,
    type ArbitraryDataSignRequest,
    type PeraArbitraryDataMessage,
    type PeraArbitraryDataSignResult,
    type SignRequestSource,
    isArc60WirePayload,
    parseArc60WireRequest,
    useArc0001Resolver,
    useEnqueueArc0001SignRequest,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import {
    BROWSER_FAVORITE_ACTION,
    GET_DEVICE_ID_ACTION,
    JsonRpcErrorCode,
    toValidatedBrowserUrl,
    requireSecure,
    safeOrigin,
    sendActionToWebview,
    sendErrorToWebview,
    sendMessageToWebview,
    type WebviewMessageSecurity,
} from './handlers'
import {
    encodeToBase64,
    generateOrderedUniqueId,
    logger,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useWalletConnectPairing } from '@modules/walletconnect/hooks/useWalletConnectPairing'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useDeepLink } from '@hooks/useDeepLink'
import { parseDeeplink } from '@hooks/deeplink/parser'
import { parseWalletConnectUri } from '@hooks/deeplink/walletconnect-parser'
import { useNetworkStatus } from '@modules/network'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'
import { AnalyticsMetadataKey, WebviewEvent, trackEvent } from '@analytics'
import {
    isSupportedBridgeMethod,
    type PeraWebviewBridgeMethod,
} from './bridge-methods'

type WebviewMessage = {
    id: string
    jsonrpc: '2.0'
    method: string
    params?: Record<string, unknown>
    // Stamped by the main-frame-only injected bridge; validated at the
    // PWWebView message boundary, ignored by handler dispatch.
    token?: string
}

/**
 * The SDK still accepts the legacy names (`HdKey`, `LedgerBle`, `NoAuth`, …);
 * the webapp is moving to these in lockstep.
 */
type WebviewAccountType =
    | 'Algo25'
    | 'HDWallet'
    | 'Hardware'
    | 'Multisig'
    | 'Unsignable'
    | 'RekeyedSignable'
    | 'RekeyedUnsignable'

// One page-initiated WC connect per origin per window, so a hostile page can't
// storm the approval sheet. Rate-limits the ORIGIN regardless of URI, unlike
// peraConnectJS's same-duration window which de-dups an identical URI — a
// pairing URI is single-use, so spam arrives as fresh URIs a de-dup waves
// through.
const WC_CONNECT_THROTTLE_WINDOW_MS = 2000

const BASE_WEBVIEW_TYPE: Record<
    WalletAccount['type'],
    Exclude<WebviewAccountType, 'RekeyedSignable' | 'RekeyedUnsignable'>
> = {
    [AccountTypes.algo25]: 'Algo25',
    [AccountTypes.hdWallet]: 'HDWallet',
    [AccountTypes.hardware]: 'Hardware',
    [AccountTypes.multisig]: 'Multisig',
    [AccountTypes.watch]: 'Unsignable',
    // The Pera SDK has no quantum identifier yet and quantum signing routing
    // lands with PQ-006, so don't advertise quantum accounts as signable.
    [AccountTypes.quantum]: 'Unsignable',
}

/**
 * Only invoked on already-filtered `signingAccounts`, so `Unsignable` and
 * `RekeyedUnsignable` never emit in practice — mapped anyway so the bridge stays
 * self-contained if that filter loosens.
 */
const toWebviewAccountType = (
    account: WalletAccount,
    accounts: WalletAccount[],
): WebviewAccountType => {
    if (isRekeyedAccount(account)) {
        return canSignWith(account, accounts)
            ? 'RekeyedSignable'
            : 'RekeyedUnsignable'
    }
    return BASE_WEBVIEW_TYPE[account.type]
}

export const usePeraWebviewInterface = (
    webview: Nullable<WebView>,
    securedConnection: boolean,
    sourceUrl: string | null,
    onCloseRequested?: () => void,
    onBackRequested?: () => void,
) => {
    const { showToast } = useToast()
    const { showError } = useErrorToast()
    const signingAccounts = useSigningAccounts()
    const allAccounts = useAllAccounts()
    const { network } = useNetwork()
    const { hasInternet } = useNetworkStatus()
    const deviceID = useDeviceID(network)
    const darkmode = useIsDarkMode()
    const theme = darkmode ? 'dark' : 'light'
    const provider = usePeraProvider()
    const deviceInfo = provider.deviceInfo
    const { preferredCurrency } = useCurrency()
    const analytics = provider.analytics
    const { t, currentLanguage } = useLanguage()
    const { pushWebView: pushWebViewContext } = useWebView()
    const { addSignRequest } = useSigningRequest()
    const { pair } = useWalletConnectPairing()
    const resolveArc0001 = useArc0001Resolver()
    const enqueueSignRequest = useEnqueueArc0001SignRequest()
    const { handleDeepLink } = useDeepLink()

    const hadRequiredParams = useCallback(
        (requiredParams: string[], message: WebviewMessage) => {
            for (const param of requiredParams) {
                if (!message.params?.[param]) {
                    sendErrorToWebview(
                        message.id,
                        JsonRpcErrorCode.InvalidParams,
                        t('errors.webview.invalid_params', { params: param }),
                        webview,
                    )
                    return false
                }
            }
            return true
        },
        [t, webview],
    )

    const pushWebView = useCallback(
        (message: WebviewMessage, security: WebviewMessageSecurity) => {
            requireSecure(
                security.securedConnection,
                {
                    operation: 'pushWebView',
                    messageId: message.id,
                    sourceUrl: security.sourceUrl,
                    webview,
                },
                () => {
                    if (!hadRequiredParams(['url'], message)) {
                        return
                    }
                    const rawUrl = message.params!.url
                    // Normalize before the https-only gate so a bare domain
                    // typed into the Discover URL bar ("perawallet.app")
                    // still opens [PERA-4553]; unsafe schemes stay rejected.
                    const url = toValidatedBrowserUrl(rawUrl)
                    if (!url) {
                        sendErrorToWebview(
                            message.id,
                            JsonRpcErrorCode.InvalidParams,
                            t('errors.webview.unsupported_url', {
                                url: String(rawUrl),
                            }),
                            webview,
                        )
                        return
                    }
                    const title = message.params?.title as string | undefined
                    const isFavorite = message.params?.isFavorite

                    // The host (Discover) sends `isFavorite` only for pages that
                    // support favoriting; without it the footer shows no star.
                    // onToggle asks the source webview — where favorites
                    // persistence lives — to flip the page's favorite state.
                    const favorite =
                        typeof isFavorite === 'boolean'
                            ? {
                                  initialIsFavorite: isFavorite,
                                  onToggle: () =>
                                      sendActionToWebview(
                                          BROWSER_FAVORITE_ACTION,
                                          {
                                              name: title ?? '',
                                              url,
                                              logo: null,
                                          },
                                          webview,
                                      ),
                              }
                            : undefined

                    pushWebViewContext({
                        url,
                        onCloseRequested,
                        onBackRequested,
                        id: message.id,
                        enablePeraConnect: true,
                        favorite,
                    })
                },
            )
        },
        [
            pushWebViewContext,
            onCloseRequested,
            onBackRequested,
            hadRequiredParams,
            t,
            webview,
        ],
    )

    const openSystemBrowser = useCallback(
        (message: WebviewMessage, security: WebviewMessageSecurity) => {
            requireSecure(
                security.securedConnection,
                {
                    operation: 'openSystemBrowser',
                    messageId: message.id,
                    sourceUrl: security.sourceUrl,
                    webview,
                },
                () => {
                    if (!hadRequiredParams(['url'], message)) {
                        return
                    }
                    const rawUrl = message.params!.url
                    // https-only until product confirms a broader allow-list.
                    // canOpenURL is a no-op on web (always resolves true), so
                    // this gate is the only one there.
                    const url = toValidatedBrowserUrl(rawUrl)
                    if (!url) {
                        sendErrorToWebview(
                            message.id,
                            JsonRpcErrorCode.InvalidParams,
                            t('errors.webview.unsupported_url', {
                                url: String(rawUrl),
                            }),
                            webview,
                        )
                        return
                    }
                    void Linking.canOpenURL(url).then(supported => {
                        if (supported) {
                            void Linking.openURL(url)
                        } else {
                            sendErrorToWebview(
                                message.id,
                                JsonRpcErrorCode.InvalidParams,
                                t('errors.webview.unsupported_url', { url }),
                                webview,
                            )
                        }
                    })
                },
            )
        },
        [hadRequiredParams, t, webview],
    )

    const canOpenURI = useCallback(
        (message: WebviewMessage, security: WebviewMessageSecurity) => {
            requireSecure(
                security.securedConnection,
                {
                    operation: 'canOpenURI',
                    messageId: message.id,
                    sourceUrl: security.sourceUrl,
                    webview,
                },
                () => {
                    if (!hadRequiredParams(['uri'], message)) {
                        return
                    }
                    void Linking.canOpenURL(message.params!.uri as string).then(
                        supported => {
                            sendMessageToWebview(
                                message.id,
                                { supported },
                                webview,
                            )
                        },
                    )
                },
            )
        },
        [hadRequiredParams, webview],
    )

    const openNativeURI = useCallback(
        (message: WebviewMessage, security: WebviewMessageSecurity) => {
            requireSecure(
                security.securedConnection,
                {
                    operation: 'openNativeURI',
                    messageId: message.id,
                    sourceUrl: security.sourceUrl,
                    webview,
                },
                () => {
                    if (!hadRequiredParams(['uri'], message)) {
                        return
                    }
                    const uri = message.params!.uri as string

                    if (parseDeeplink(uri)) {
                        void handleDeepLink(uri, false, 'in-app')
                        return
                    }

                    void Linking.canOpenURL(uri)
                        .then(supported => {
                            if (supported) {
                                void Linking.openURL(uri)
                            } else {
                                sendErrorToWebview(
                                    message.id,
                                    JsonRpcErrorCode.InvalidParams,
                                    t('errors.webview.unsupported_url', {
                                        url: uri,
                                    }),
                                    webview,
                                )
                            }
                        })
                        .catch(() => {
                            sendErrorToWebview(
                                message.id,
                                JsonRpcErrorCode.InvalidParams,
                                t('errors.webview.unsupported_url', {
                                    url: uri,
                                }),
                                webview,
                            )
                        })
                },
            )
        },
        [hadRequiredParams, handleDeepLink, t, webview],
    )

    const notifyUser = useCallback(
        (message: WebviewMessage, security: WebviewMessageSecurity) => {
            requireSecure(
                security.securedConnection,
                {
                    operation: 'notifyUser',
                    messageId: message.id,
                    sourceUrl: security.sourceUrl,
                    webview,
                },
                () => {
                    if (!hadRequiredParams(['type'], message)) {
                        return
                    }
                    if (message.params?.type === 'message') {
                        showToast({
                            title: '',
                            body: message.params?.message as string,
                            type: 'info',
                        })
                    }
                    //TODO add haptic (and maybe message.banner) support and maybe sound
                },
            )
        },
        [webview, hadRequiredParams, showToast],
    )

    const getAddresses = useCallback(
        (message: WebviewMessage, security: WebviewMessageSecurity) => {
            requireSecure(
                security.securedConnection,
                {
                    operation: 'getAddresses',
                    messageId: message.id,
                    sourceUrl: security.sourceUrl,
                    webview,
                },
                () => {
                    // Matches Android's `GetAuthorizedAddressesInfoWebMessages`.
                    // Send the RAW `account.name`, empty when unset: the webapp
                    // owns the truncated-address fallback, and sending that as
                    // both name and address made its rows render the same string
                    // twice. Ordering is the consumer's responsibility.
                    const payload = signingAccounts.map(account => ({
                        name: account.name ?? '',
                        address: account.address,
                        type: toWebviewAccountType(account, allAccounts),
                    }))
                    sendMessageToWebview(message.id, payload, webview)
                },
            )
        },
        [signingAccounts, allAccounts, webview],
    )

    const getSettings = useCallback(
        (message: WebviewMessage, security: WebviewMessageSecurity) => {
            requireSecure(
                security.securedConnection,
                {
                    operation: 'getSettings',
                    messageId: message.id,
                    sourceUrl: security.sourceUrl,
                    webview,
                },
                () => {
                    const payload = {
                        appName: deviceInfo.getAppName(),
                        appPackageName: deviceInfo.getAppPackage(),
                        appVersion: deviceInfo.getAppVersion(),
                        clientType: deviceInfo.getDevicePlatform(),
                        deviceId: deviceID,
                        deviceVersion: deviceInfo.getDeviceModel(),
                        deviceOSVersion: deviceInfo.getDeviceOSVersion(),
                        deviceModel: deviceInfo.getDeviceModel(),
                        theme,
                        network,
                        currency: preferredCurrency,
                        region: deviceInfo.getDeviceCountry(),
                        // The app's resolved locale, not the device's. Before
                        // the in-app language picker existed the two were
                        // always the same, so reading the device was harmless;
                        // now a user on an English phone who picks Turkish
                        // would get a Turkish app around an English Discover.
                        // `region` still comes from the device — that answers
                        // "where are you", which the picker doesn't change.
                        language: resolveWebviewLanguage(currentLanguage),
                        protocolVersion: '3',
                    }
                    sendMessageToWebview(message.id, payload, webview)
                },
            )
        },
        [
            deviceID,
            deviceInfo,
            preferredCurrency,
            theme,
            network,
            currentLanguage,
            webview,
        ],
    )

    const requestTransactionSigning = useCallback(
        (message: WebviewMessage, security: WebviewMessageSecurity) => {
            requireSecure(
                security.securedConnection,
                {
                    operation: 'requestTransactionSigning',
                    messageId: message.id,
                    sourceUrl: security.sourceUrl,
                    webview,
                },
                () => {
                    if (!hadRequiredParams(['txns', 'metadata'], message)) {
                        return
                    }
                    const txns = message.params![
                        'txns'
                    ] as Arc0001WalletTransaction[]
                    const opts = message.params!['opts'] as
                        | Arc0001SignTxnsOpts
                        | undefined
                    const metadata = message.params![
                        'metadata'
                    ] as SignRequestSource

                    try {
                        // No authorizedAddresses — the webview's trust model
                        // is per-origin (requireSecure), not per-account.
                        const resolved = resolveArc0001({
                            transactions: txns,
                            opts,
                        })

                        // Fire-and-forget despite `enqueueSignRequest` being
                        // async: `requireSecure` wants a void callback,
                        // `resolveArc0001`'s throw must reach the catch below
                        // synchronously, and the enqueue handles its own
                        // failures via respondWithError.
                        void enqueueSignRequest(resolved, {
                            sourceType: 'webview',
                            transportId: message.id,
                            sourceMetadata: metadata,
                            // Platform-observed origin — unlike sourceMetadata
                            // the page can't assert it, so it's what gates the
                            // verification badge (PERA-4715).
                            verifiedOrigin: sourceUrl ?? undefined,
                            respondWithResult: result =>
                                sendMessageToWebview(
                                    message.id,
                                    result,
                                    webview,
                                ),
                            respondWithReject: () =>
                                sendErrorToWebview(
                                    message.id,
                                    JsonRpcErrorCode.InternalError,
                                    'User rejected',
                                    webview,
                                ),
                            respondWithError: err =>
                                sendErrorToWebview(
                                    message.id,
                                    JsonRpcErrorCode.InternalError,
                                    err,
                                    webview,
                                ),
                        })
                    } catch (e) {
                        // Logged at the transport boundary, like the
                        // WalletConnect transport, so real-world dApp failures
                        // stay observable whichever resolve path threw.
                        logger.warn('ARC-0001 sign request rejected', {
                            code: (e as { code?: number }).code,
                            message: (e as Error).message,
                        })
                        // 4100 (Unauthorized) is the only ARC-0001 code that
                        // gets a dedicated JSON-RPC slot; everything else
                        // (4200/4201/4300) is structurally a bad request.
                        const code =
                            (e as { code?: number }).code === 4100
                                ? JsonRpcErrorCode.Unauthorized
                                : JsonRpcErrorCode.InvalidParams
                        sendErrorToWebview(
                            message.id,
                            code,
                            e as Error,
                            webview,
                        )
                        // The dApp gets the protocol message via
                        // sendErrorToWebview above; the user gets localized copy,
                        // with the raw detail logged (and appended only when
                        // config.debugEnabled).
                        showError(e, t('errors.signing.title'))
                    }
                },
            )
        },
        [
            webview,
            hadRequiredParams,
            resolveArc0001,
            enqueueSignRequest,
            sourceUrl,
            showError,
            t,
        ],
    )

    const requestDataSigning = useCallback(
        (message: WebviewMessage, security: WebviewMessageSecurity) => {
            requireSecure(
                security.securedConnection,
                {
                    operation: 'requestDataSigning',
                    messageId: message.id,
                    sourceUrl: security.sourceUrl,
                    webview,
                },
                () => {
                    // ARC-60 (`StdSigData` + `Metadata`) and the legacy
                    // arbitrary-data shape both arrive on `requestDataSigning`;
                    // discriminate on the ARC-60 signals before the legacy
                    // param check (which an ARC-60 payload would also satisfy).
                    if (isArc60WirePayload(message.params)) {
                        try {
                            const { stdSigData, metadata } =
                                parseArc60WireRequest(message.params)
                            const account = allAccounts.find(
                                a => a.address === stdSigData.signer,
                            )
                            if (!account || !canSignArc60(account)) {
                                sendErrorToWebview(
                                    message.id,
                                    JsonRpcErrorCode.InvalidParams,
                                    t('errors.webview.invalid_params', {
                                        params: 'signer',
                                    }),
                                    webview,
                                )
                                return
                            }
                            addSignRequest({
                                id: generateOrderedUniqueId(),
                                type: 'arc60',
                                transport: 'callback',
                                sourceType: 'webview',
                                transportId: message.id,
                                // The verified webview origin — NOT the
                                // dApp-asserted metadata — is what the analyzer
                                // checks the SIWA domain against.
                                sourceMetadata: security.sourceUrl
                                    ? { url: security.sourceUrl }
                                    : undefined,
                                verifiedOrigin: security.sourceUrl ?? undefined,
                                stdSigData,
                                metadata,
                                approve: async (
                                    signed: PeraArbitraryDataSignResult[],
                                ) => {
                                    sendMessageToWebview(
                                        message.id,
                                        signed.map(s =>
                                            encodeToBase64(s.signature),
                                        ),
                                        webview,
                                    )
                                },
                                reject: async () => {
                                    sendErrorToWebview(
                                        message.id,
                                        JsonRpcErrorCode.InternalError,
                                        'User rejected',
                                        webview,
                                    )
                                },
                                error: async (err: Error) =>
                                    sendErrorToWebview(
                                        message.id,
                                        JsonRpcErrorCode.InternalError,
                                        err,
                                        webview,
                                    ),
                            } as Arc60SignRequest)
                        } catch (e) {
                            sendErrorToWebview(
                                message.id,
                                JsonRpcErrorCode.InvalidParams,
                                e as Error,
                                webview,
                            )
                        }
                        return
                    }

                    if (!hadRequiredParams(['data', 'metadata'], message)) {
                        return
                    }
                    const data = message.params![
                        'data'
                    ] as Partial<PeraArbitraryDataMessage>
                    const signer = data.signer

                    if (!signer) {
                        sendErrorToWebview(
                            message.id,
                            JsonRpcErrorCode.InvalidParams,
                            t('errors.webview.invalid_params', {
                                params: 'signer',
                            }),
                            webview,
                        )
                        return
                    }
                    // Preflight parity with the WC transport: a signer that
                    // can't sign raw bytes (Ledger, watch) must be rejected
                    // before the review sheet, not after the user slides.
                    const signerAccount = allAccounts.find(
                        account => account.address === signer,
                    )
                    if (
                        !signerAccount ||
                        !canSignArbitraryData(signerAccount)
                    ) {
                        sendErrorToWebview(
                            message.id,
                            JsonRpcErrorCode.InvalidParams,
                            'Signer cannot sign arbitrary data',
                            webview,
                        )
                        return
                    }
                    const metadata = message.params![
                        'metadata'
                    ] as SignRequestSource
                    try {
                        addSignRequest({
                            id: generateOrderedUniqueId(),
                            type: 'arbitrary-data',
                            transport: 'callback',
                            sourceType: 'webview',
                            transportId: message.id,
                            sourceMetadata: metadata,
                            // Platform-observed origin, not page-asserted —
                            // gates the verification badge (PERA-4715).
                            verifiedOrigin: sourceUrl ?? undefined,
                            data: [data],
                            approve: async (
                                signed: PeraArbitraryDataSignResult[],
                            ) => {
                                sendMessageToWebview(
                                    message.id,
                                    signed.map(s =>
                                        encodeToBase64(s.signature),
                                    ),
                                    webview,
                                )
                            },
                            reject: async () => {
                                sendErrorToWebview(
                                    message.id,
                                    JsonRpcErrorCode.InternalError,
                                    'User rejected',
                                    webview,
                                )
                            },
                            error: async (err: Error) =>
                                sendErrorToWebview(
                                    message.id,
                                    JsonRpcErrorCode.InternalError,
                                    err,
                                    webview,
                                ),
                        } as ArbitraryDataSignRequest)
                    } catch (e) {
                        sendErrorToWebview(
                            message.id,
                            JsonRpcErrorCode.InternalError,
                            e as Error,
                            webview,
                        )
                        // The dApp gets the protocol message via
                        // sendErrorToWebview above; the user gets localized copy,
                        // with the raw detail logged (and appended only when
                        // config.debugEnabled).
                        showError(e, t('errors.signing.title'))
                    }
                },
            )
        },
        [
            webview,
            hadRequiredParams,
            addSignRequest,
            allAccounts,
            sourceUrl,
            showError,
            t,
        ],
    )

    const getDeviceId = useCallback(
        (message: WebviewMessage, security: WebviewMessageSecurity) => {
            requireSecure(
                security.securedConnection,
                {
                    operation: 'getDeviceId',
                    messageId: message.id,
                    sourceUrl: security.sourceUrl,
                    webview,
                },
                () => {
                    if (!deviceID) {
                        return
                    }
                    sendActionToWebview(GET_DEVICE_ID_ACTION, deviceID, webview)
                },
            )
        },
        [deviceID, webview],
    )

    // Discover reads the device id once at load and only fetches server-side
    // favorites while it holds a non-null one — so an id arriving later (store
    // hydration, migration, re-registration) is never picked up, since it never
    // retries. Pushing changes refires its favorites fetch. The initial mount is
    // skipped, since getSettings already carried that value.
    const previousDeviceIDRef = useRef<string | null | undefined>(undefined)
    useEffect(() => {
        const previous = previousDeviceIDRef.current
        previousDeviceIDRef.current = deviceID
        if (previous === undefined) {
            return
        }
        if (previous === deviceID) {
            return
        }
        // App-initiated push, so there is no message frame to judge — the
        // hook-level decision is the only trust signal available.
        if (!securedConnection || !deviceID || !webview) {
            return
        }
        sendActionToWebview(GET_DEVICE_ID_ACTION, deviceID, webview)
    }, [deviceID, securedConnection, webview])

    const getPublicSettings = useCallback(
        (message: WebviewMessage) => {
            const payload = {
                theme,
                network,
                currency: preferredCurrency,
                language: resolveWebviewLanguage(currentLanguage),
            }
            sendMessageToWebview(message.id, payload, webview)
        },
        [preferredCurrency, theme, network, currentLanguage, webview],
    )

    // Keyed by origin: an in-place navigation must not let one site's connect
    // throttle the next site's, and each origin gets its own budget.
    const lastWcConnectByOriginRef = useRef(new Map<string, number>())

    const openWalletConnect = useCallback(
        (message: WebviewMessage) => {
            if (!hadRequiredParams(['uri'], message)) {
                return
            }

            const rawUri = message.params!.uri as string
            const parsed = parseWalletConnectUri(rawUri)
            if (!parsed) {
                sendErrorToWebview(
                    message.id,
                    JsonRpcErrorCode.InvalidParams,
                    'Invalid WalletConnect URI',
                    webview,
                )
                return
            }

            // Pairing needs a live bridge; fail the page fast instead of
            // letting the handshake rot silently until its timeout.
            if (!hasInternet) {
                sendErrorToWebview(
                    message.id,
                    JsonRpcErrorCode.InternalError,
                    'Cannot open a WalletConnect session while offline',
                    webview,
                )
                return
            }

            const now = Date.now()
            const throttleKey = safeOrigin(sourceUrl ?? '') ?? sourceUrl ?? ''
            const lastConnectAt =
                lastWcConnectByOriginRef.current.get(throttleKey) ?? 0
            if (now - lastConnectAt < WC_CONNECT_THROTTLE_WINDOW_MS) {
                logger.warn('[webview/wc] connect throttled', { throttleKey })
                sendErrorToWebview(
                    message.id,
                    JsonRpcErrorCode.InvalidRequest,
                    'WalletConnect connection request throttled',
                    webview,
                )
                return
            }
            lastWcConnectByOriginRef.current.set(throttleKey, now)

            // Always surfaces the approval sheet, as if the user scanned the QR
            // — the bridge never auto-approves a session regardless of origin
            // trust, since that would expose addresses with no UI. `pair` is
            // bounded like the deeplink path so the page gets a readable error
            // rather than silence.
            void (async () => {
                const result = await pair(parsed.uri, {
                    origin: { source: 'in-app' },
                })
                if (result.type === 'connect-failed') {
                    logger.error('[webview/wc] connect failed', {
                        error: result.error,
                        uri: parsed.uri,
                    })
                    sendErrorToWebview(
                        message.id,
                        JsonRpcErrorCode.InternalError,
                        'Could not start the WalletConnect session',
                        webview,
                    )
                    return
                }
                if (result.type === 'error') {
                    // Relay the surfaced reason (e.g. wrong network) —
                    // passing the Error object would collapse it into the
                    // generic signing-error copy.
                    sendErrorToWebview(
                        message.id,
                        JsonRpcErrorCode.InternalError,
                        result.error.message,
                        webview,
                    )
                    return
                }
                if (result.type === 'timeout') {
                    sendErrorToWebview(
                        message.id,
                        JsonRpcErrorCode.InternalError,
                        'No response from the dApp. The session may be expired or the WalletConnect bridge may be unreachable.',
                        webview,
                    )
                }
                // 'session': on native, the approval sheet pops via the
                // provider and the page hears back through the session
                // approve/reject path. On web, `result.type === 'session'`
                // here IS a genuine cross-realm signal, not just "dispatched"
                // — it means offscreen's `wcHost.ts` resolved this pairing's
                // `pair-outcome` because a real `session_request` landed on
                // the connector it created (see `useWalletConnectPairing.
                // web.ts`). The wc-connect approval window itself still opens
                // separately, as its own window via the offscreen host's
                // approval request — this callback has no handle on that
                // window or its eventual decision, only on the fact that a
                // handshake was reached.
            })()
        },
        [pair, hadRequiredParams, webview, hasInternet, sourceUrl],
    )

    const onBackPressed = useCallback(() => {
        onBackRequested?.()
    }, [onBackRequested])

    const logAnalyticsEvent = useCallback(
        (message: WebviewMessage, security: WebviewMessageSecurity) => {
            requireSecure(
                security.securedConnection,
                {
                    operation: 'logAnalyticsEvent',
                    messageId: message.id,
                    sourceUrl: security.sourceUrl,
                    webview,
                },
                () => {
                    if (!hadRequiredParams(['name', 'payload'], message)) {
                        return
                    }
                    analytics.logEvent(
                        message.params!.name as string,
                        message.params!.payload,
                    )
                },
            )
        },
        [analytics, hadRequiredParams, webview],
    )

    const closeWebView = useCallback(() => {
        onCloseRequested?.()
    }, [onCloseRequested])

    const handleMessage = useCallback(
        (
            message: WebviewMessage | WebviewMessage[],
            // Native derives this per message (a message can race a
            // navigation); web's origin is mount-fixed. Omitting it falls back
            // to the mount-level decision.
            messageSecurity?: WebviewMessageSecurity,
        ) => {
            if (!Array.isArray(message)) {
                message = [message]
            }
            const security = messageSecurity ?? { securedConnection, sourceUrl }
            logger.debug('Received webview interface call', { message })
            // Keyed by the exported v3 method set so the compiler rejects a
            // dispatch entry that drifts from PERA_WEBVIEW_BRIDGE_METHODS.
            const handlers: Record<
                PeraWebviewBridgeMethod,
                (
                    message: WebviewMessage,
                    security: WebviewMessageSecurity,
                ) => void
            > = {
                pushWebView,
                openSystemBrowser,
                canOpenURI,
                openNativeURI,
                notifyUser,
                getAddresses,
                getSettings,
                getDeviceId,
                getPublicSettings,
                onBackPressed,
                logAnalyticsEvent,
                closeWebView,
                requestTransactionSigning,
                requestDataSigning,
                walletConnect: openWalletConnect,
            }
            message.forEach(message => {
                const { method } = message
                if (!isSupportedBridgeMethod(method)) {
                    trackEvent(WebviewEvent.BridgeMethodNotFound, {
                        [AnalyticsMetadataKey.WebviewBridgeMethod]: method,
                        ...(security.sourceUrl
                            ? { [AnalyticsMetadataKey.Url]: security.sourceUrl }
                            : {}),
                    })
                    if (__DEV__) {
                        // eslint-disable-next-line no-console
                        console.warn(
                            `[webview-bridge] Unknown method "${method}" from ${security.sourceUrl ?? 'unknown origin'} — not part of the v3 contract (docs/DISCOVER_BRIDGE_CONTRACT.md)`,
                        )
                    }
                    sendErrorToWebview(
                        message.id,
                        JsonRpcErrorCode.MethodNotFound,
                        t('errors.webview.invalid_method', { method }),
                        webview,
                    )
                    return
                }
                handlers[method](message, security)
            })
        },
        [
            pushWebView,
            openSystemBrowser,
            canOpenURI,
            openNativeURI,
            notifyUser,
            getAddresses,
            getSettings,
            getDeviceId,
            getPublicSettings,
            onBackPressed,
            logAnalyticsEvent,
            closeWebView,
            requestTransactionSigning,
            requestDataSigning,
            openWalletConnect,
            securedConnection,
            sourceUrl,
            webview,
            t,
        ],
    )

    return {
        handleMessage,
    }
}
