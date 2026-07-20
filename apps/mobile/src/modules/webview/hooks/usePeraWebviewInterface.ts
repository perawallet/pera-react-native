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
    requireSecure,
    sendActionToWebview,
    sendErrorToWebview,
    sendMessageToWebview,
} from './handlers'
import {
    encodeToBase64,
    generateOrderedUniqueId,
    logger,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    useWalletConnect,
    waitForSessionOutcome,
} from '@perawallet/wallet-core-walletconnect'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useDeepLink } from '@hooks/useDeepLink'
import { parseDeeplink } from '@hooks/deeplink/parser'
import { parseWalletConnectUri } from '@hooks/deeplink/walletconnect-parser'
import { withTimeout } from '@hooks/deeplink/handlers/timeout'
import { useNetworkStatus } from '@modules/network'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'

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
 * Type identifiers we expose to dApps over the webview bridge. The Pera SDK
 * currently accepts the legacy names (`HdKey`, `LedgerBle`, `NoAuth`,
 * `Rekeyed`, `RekeyedAuth`, `Joint`); the webapp side is being updated to the
 * names below in lockstep with this change.
 */
type WebviewAccountType =
    | 'Algo25'
    | 'HDWallet'
    | 'Hardware'
    | 'Multisig'
    | 'Unsignable'
    | 'RekeyedSignable'
    | 'RekeyedUnsignable'

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
 * Maps an account onto the type identifier we hand to the webapp. Only
 * invoked on `signingAccounts`, which has already filtered out non-signing
 * accounts — `Unsignable` and `RekeyedUnsignable` won't actually be emitted
 * in practice, but the full mapping is kept here so the bridge remains
 * self-contained should the upstream filter ever loosen.
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
    const { t } = useLanguage()
    const { pushWebView: pushWebViewContext } = useWebView()
    const { addSignRequest } = useSigningRequest()
    const { connect } = useWalletConnect(network)
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
        (message: WebviewMessage) => {
            requireSecure(
                securedConnection,
                {
                    operation: 'pushWebView',
                    messageId: message.id,
                    sourceUrl,
                    webview,
                },
                () => {
                    if (!hadRequiredParams(['url'], message)) {
                        return
                    }
                    const url = message.params!.url as string
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
            securedConnection,
            sourceUrl,
            onCloseRequested,
            onBackRequested,
            hadRequiredParams,
            webview,
        ],
    )

    const openSystemBrowser = useCallback(
        (message: WebviewMessage) => {
            requireSecure(
                securedConnection,
                {
                    operation: 'openSystemBrowser',
                    messageId: message.id,
                    sourceUrl,
                    webview,
                },
                () => {
                    if (!hadRequiredParams(['url'], message)) {
                        return
                    }
                    void Linking.canOpenURL(message.params!.url as string).then(
                        supported => {
                            if (supported) {
                                void Linking.openURL(
                                    message.params?.url as string,
                                )
                            } else {
                                sendErrorToWebview(
                                    message.id,
                                    JsonRpcErrorCode.InvalidParams,
                                    t('errors.webview.unsupported_url', {
                                        url: message.params?.url,
                                    }),
                                    webview,
                                )
                            }
                        },
                    )
                },
            )
        },
        [securedConnection, sourceUrl, hadRequiredParams, t, webview],
    )

    const canOpenURI = useCallback(
        (message: WebviewMessage) => {
            requireSecure(
                securedConnection,
                {
                    operation: 'canOpenURI',
                    messageId: message.id,
                    sourceUrl,
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
        [securedConnection, sourceUrl, hadRequiredParams, webview],
    )

    const openNativeURI = useCallback(
        (message: WebviewMessage) => {
            requireSecure(
                securedConnection,
                {
                    operation: 'openNativeURI',
                    messageId: message.id,
                    sourceUrl,
                    webview,
                },
                () => {
                    if (!hadRequiredParams(['uri'], message)) {
                        return
                    }
                    const uri = message.params!.uri as string

                    if (parseDeeplink(uri)) {
                        void handleDeepLink(uri, false, 'deeplink')
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
        [
            securedConnection,
            sourceUrl,
            hadRequiredParams,
            handleDeepLink,
            t,
            webview,
        ],
    )

    const notifyUser = useCallback(
        (message: WebviewMessage) => {
            requireSecure(
                securedConnection,
                {
                    operation: 'notifyUser',
                    messageId: message.id,
                    sourceUrl,
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
        [securedConnection, sourceUrl, webview, hadRequiredParams, showToast],
    )

    const getAddresses = useCallback(
        (message: WebviewMessage) => {
            requireSecure(
                securedConnection,
                {
                    operation: 'getAddresses',
                    messageId: message.id,
                    sourceUrl,
                    webview,
                },
                () => {
                    // Match Android's `GetAuthorizedAddressesInfoWebMessages`:
                    // 1. `useSigningAccounts` drops Watch / Rekeyed-no-auth so
                    //    the user can't pick a non-funding-eligible account.
                    // 2. Send raw `account.name` (empty string when none). The
                    //    webapp owns the truncated-address fallback; sending
                    //    the truncated address as both name AND address (via
                    //    getAccountDisplayName) made the webapp render the
                    //    same string twice in its list rows.
                    // Ordering is the consumer's responsibility — Pera Connect
                    // sorts on its side based on its own UX needs.
                    const payload = signingAccounts.map(account => ({
                        name: account.name ?? '',
                        address: account.address,
                        type: toWebviewAccountType(account, allAccounts),
                    }))
                    sendMessageToWebview(message.id, payload, webview)
                },
            )
        },
        [securedConnection, sourceUrl, signingAccounts, allAccounts, webview],
    )

    const getSettings = useCallback(
        (message: WebviewMessage) => {
            requireSecure(
                securedConnection,
                {
                    operation: 'getSettings',
                    messageId: message.id,
                    sourceUrl,
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
                        deviceOSVersion: deviceInfo.getDevicePlatform(),
                        deviceModel: deviceInfo.getDeviceModel(),
                        theme,
                        network,
                        currency: preferredCurrency,
                        region: deviceInfo.getDeviceCountry(),
                        language: deviceInfo.getDeviceLocale(),
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
            securedConnection,
            sourceUrl,
            theme,
            network,
            webview,
        ],
    )

    const requestTransactionSigning = useCallback(
        (message: WebviewMessage) => {
            requireSecure(
                securedConnection,
                {
                    operation: 'requestTransactionSigning',
                    messageId: message.id,
                    sourceUrl,
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

                        enqueueSignRequest(resolved, {
                            sourceType: 'webview',
                            transportId: message.id,
                            sourceMetadata: metadata,
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
                        // Log every relayed rejection here at the transport
                        // boundary (parity with the WalletConnect transport's
                        // surfaceError) so real-world dApp failures — e.g.
                        // algosdk v3's strict decode rejections (PERA-4503) —
                        // are observable regardless of which resolve path threw.
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
                        // guardrails-ignore-next-line no-error-toast-in-catch reason: dApp signing path surfaces raw error message verbatim for diagnosis
                        showToast({
                            title: t('errors.signing.title'),
                            body: (e as Error).message,
                            type: 'error',
                        })
                    }
                },
            )
        },
        [
            securedConnection,
            sourceUrl,
            webview,
            hadRequiredParams,
            resolveArc0001,
            enqueueSignRequest,
            showToast,
            t,
        ],
    )

    const requestDataSigning = useCallback(
        (message: WebviewMessage) => {
            requireSecure(
                securedConnection,
                {
                    operation: 'requestDataSigning',
                    messageId: message.id,
                    sourceUrl,
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
                                sourceMetadata: sourceUrl
                                    ? { url: sourceUrl }
                                    : undefined,
                                verifiedOrigin: sourceUrl ?? undefined,
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
                        // guardrails-ignore-next-line no-error-toast-in-catch reason: dApp signing path surfaces raw error message verbatim for diagnosis
                        showToast({
                            title: t('errors.signing.title'),
                            body: (e as Error).message,
                            type: 'error',
                        })
                    }
                },
            )
        },
        [
            securedConnection,
            sourceUrl,
            webview,
            hadRequiredParams,
            addSignRequest,
            allAccounts,
            showToast,
            t,
        ],
    )

    const getDeviceId = useCallback(
        (message: WebviewMessage) => {
            requireSecure(
                securedConnection,
                {
                    operation: 'getDeviceId',
                    messageId: message.id,
                    sourceUrl,
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
        [securedConnection, sourceUrl, deviceID, webview],
    )

    // PERA-4564: The Discover web app reads the device id once (via
    // getSettings) when it loads and only fetches the user's server-side
    // favorites while it holds a non-null id. If the migrated device id lands
    // *after* that first query — store hydration, migration finishing, or
    // device re-registration — getSettings already returned null and the web
    // app never retries. Push the id to the live web app whenever it changes
    // so its device-id listener refires the favorites fetch. Skip the initial
    // mount: getSettings already carries the mount-time value.
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
                language: 'en-US', //TODO pull from app locale
            }
            sendMessageToWebview(message.id, payload, webview)
        },
        [preferredCurrency, theme, network, webview],
    )

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

            // Always surface the connection approval sheet — as if the user
            // had scanned the QR themselves. The bridge never auto-approves a
            // WC session (which would expose account addresses with no UI),
            // regardless of origin trust.
            // Bounded like the deeplink path: wait for this pairing's
            // session_request / connection error and answer the page with a
            // readable error instead of staying silent forever.
            void (async () => {
                let pairingClientId: string
                try {
                    pairingClientId = await withTimeout(
                        'walletConnect.connect',
                        10_000,
                        connect({ connection: { uri: parsed.uri } }),
                    )
                } catch (error) {
                    logger.error('[webview/wc] connect failed', {
                        error,
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
                const outcome = await waitForSessionOutcome(
                    pairingClientId,
                    8000,
                )
                if (outcome.type === 'error') {
                    // Relay the surfaced reason (e.g. wrong network) —
                    // passing the Error object would collapse it into the
                    // generic signing-error copy.
                    sendErrorToWebview(
                        message.id,
                        JsonRpcErrorCode.InternalError,
                        outcome.error.message,
                        webview,
                    )
                    return
                }
                if (outcome.type === 'timeout') {
                    sendErrorToWebview(
                        message.id,
                        JsonRpcErrorCode.InternalError,
                        'No response from the dApp. The session may be expired or the WalletConnect bridge may be unreachable.',
                        webview,
                    )
                }
                // 'session': the approval sheet pops via the provider; the
                // page hears back through the session approve/reject path.
            })()
        },
        [connect, hadRequiredParams, webview, hasInternet],
    )

    const onBackPressed = useCallback(() => {
        onBackRequested?.()
    }, [onBackRequested])

    const logAnalyticsEvent = useCallback(
        (message: WebviewMessage) => {
            requireSecure(
                securedConnection,
                {
                    operation: 'logAnalyticsEvent',
                    messageId: message.id,
                    sourceUrl,
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
        [analytics, securedConnection, sourceUrl, hadRequiredParams, webview],
    )

    const closeWebView = useCallback(() => {
        onCloseRequested?.()
    }, [onCloseRequested])

    const handleMessage = useCallback(
        (message: WebviewMessage | WebviewMessage[]) => {
            if (!Array.isArray(message)) {
                message = [message]
            }
            logger.debug('Received webview interface call', { message })
            message.forEach(message => {
                switch (message.method) {
                    case 'pushWebView': {
                        pushWebView(message)
                        break
                    }
                    case 'openSystemBrowser': {
                        openSystemBrowser(message)
                        break
                    }
                    case 'canOpenURI': {
                        canOpenURI(message)
                        break
                    }
                    case 'openNativeURI': {
                        openNativeURI(message)
                        break
                    }
                    case 'notifyUser': {
                        notifyUser(message)
                        break
                    }
                    case 'getAddresses': {
                        getAddresses(message)
                        break
                    }
                    case 'getSettings': {
                        getSettings(message)
                        break
                    }
                    case 'getDeviceId': {
                        getDeviceId(message)
                        break
                    }
                    case 'getPublicSettings': {
                        getPublicSettings(message)
                        break
                    }
                    case 'onBackPressed': {
                        onBackPressed()
                        break
                    }
                    case 'logAnalyticsEvent': {
                        logAnalyticsEvent(message)
                        break
                    }
                    case 'closeWebView': {
                        closeWebView()
                        break
                    }
                    case 'requestTransactionSigning': {
                        requestTransactionSigning(message)
                        break
                    }
                    case 'requestDataSigning': {
                        requestDataSigning(message)
                        break
                    }
                    case 'walletConnect': {
                        openWalletConnect(message)
                        break
                    }
                    default: {
                        sendErrorToWebview(
                            message.id,
                            JsonRpcErrorCode.MethodNotFound,
                            t('errors.webview.invalid_method', {
                                method: message.method,
                            }),
                            webview,
                        )
                        break
                    }
                }
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
            webview,
            t,
        ],
    )

    return {
        handleMessage,
    }
}
