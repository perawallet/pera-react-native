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

import { useCallback } from 'react'
import type WebView from 'react-native-webview'
import {
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    canSignArbitraryData,
    findAccountByAddressOn,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import {
    encodeToBase64,
    generateOrderedUniqueId,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    type PeraArbitraryDataMessage,
    type PeraArbitraryDataSignResult,
    type SignRequestSource,
    isAuthDataWirePayload,
    legacyArbitraryDataWireSchema,
    messageSignerChainAdapters,
    parseAuthDataWireRequest,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import {
    JsonRpcErrorCode,
    sendErrorToWebview,
    sendMessageToWebview,
} from '../handlers'
import type { BridgeHandler } from './types'
import { useRequiredParams } from './useRequiredParams'

// Auth-data and legacy arbitrary-data requests share one page answer.
const webviewDataSignRequestBase = (
    chainId: ChainId,
    messageId: string,
    webview: Nullable<WebView>,
) => ({
    id: generateOrderedUniqueId(),
    chainId,
    transport: 'callback' as const,
    sourceType: 'webview' as const,
    transportId: messageId,
    approve: async (signed: PeraArbitraryDataSignResult[]) => {
        sendMessageToWebview(
            messageId,
            signed.map(s => encodeToBase64(s.signature)),
            webview,
        )
    },
    reject: async () => {
        sendErrorToWebview(
            messageId,
            JsonRpcErrorCode.InternalError,
            'User rejected',
            webview,
        )
    },
    error: async (err: Error) =>
        sendErrorToWebview(
            messageId,
            JsonRpcErrorCode.InternalError,
            err,
            webview,
        ),
})

export const useDataSigningHandler = (
    webview: Nullable<WebView>,
    sourceUrl: string | null,
): BridgeHandler => {
    const { t } = useLanguage()
    const { showError } = useErrorToast()
    const allAccounts = useAllAccounts()
    const { addSignRequest } = useSigningRequest()
    const hasRequiredParams = useRequiredParams(webview)

    const sendInvalidSigner = useCallback(
        (messageId: string) =>
            sendErrorToWebview(
                messageId,
                JsonRpcErrorCode.InvalidParams,
                t('errors.webview.invalid_params', { params: 'signer' }),
                webview,
            ),
        [t, webview],
    )

    return useCallback(
        (message, security) => {
            // The auth-data shape and the legacy arbitrary-data shape both
            // arrive on `requestDataSigning`; discriminate on the auth-data
            // signals before the legacy param check (which an auth-data
            // payload would also satisfy).
            // The discriminator resolves the chain's message signer and throws
            // when none is registered, so it sits inside the try that answers
            // the page.
            try {
                if (isAuthDataWirePayload(LEGACY_CHAIN_ID, message.params)) {
                    const { authData, metadata } = parseAuthDataWireRequest(
                        LEGACY_CHAIN_ID,
                        message.params,
                    )
                    const account = findAccountByAddressOn(
                        allAccounts,
                        LEGACY_CHAIN_ID,
                        authData.signer,
                    )
                    if (
                        !account ||
                        !messageSignerChainAdapters
                            .get(LEGACY_CHAIN_ID)
                            .canSign(account, 'authData')
                    ) {
                        sendInvalidSigner(message.id)
                        return
                    }
                    addSignRequest({
                        ...webviewDataSignRequestBase(
                            LEGACY_CHAIN_ID,
                            message.id,
                            webview,
                        ),
                        type: 'auth-data',
                        // The verified webview origin — NOT the dApp-asserted
                        // metadata — is what the analyzer checks the sign-in
                        // domain against.
                        sourceMetadata: security.sourceUrl
                            ? { url: security.sourceUrl }
                            : undefined,
                        verifiedOrigin: security.sourceUrl ?? undefined,
                        authData,
                        metadata,
                    })
                    return
                }
            } catch (e) {
                sendErrorToWebview(
                    message.id,
                    JsonRpcErrorCode.InvalidParams,
                    e as Error,
                    webview,
                )
                return
            }

            if (!hasRequiredParams(['data', 'metadata'], message)) {
                return
            }
            const data = message.params![
                'data'
            ] as Partial<PeraArbitraryDataMessage>
            const signer = data.signer

            if (!signer) {
                sendInvalidSigner(message.id)
                return
            }
            // Preflight parity with the WC transport: a signer that can't sign
            // raw bytes (Ledger, watch) must be rejected before the review
            // sheet, not after the user slides.
            const signerAccount = findAccountByAddressOn(
                allAccounts,
                LEGACY_CHAIN_ID,
                signer,
            )
            if (!signerAccount || !canSignArbitraryData(signerAccount)) {
                sendErrorToWebview(
                    message.id,
                    JsonRpcErrorCode.InvalidParams,
                    'Signer cannot sign arbitrary data',
                    webview,
                )
                return
            }
            const parsed = legacyArbitraryDataWireSchema.safeParse([data])
            if (!parsed.success) {
                sendErrorToWebview(
                    message.id,
                    JsonRpcErrorCode.InvalidParams,
                    'Invalid arbitrary data payload',
                    webview,
                )
                return
            }
            const metadata = message.params!['metadata'] as SignRequestSource
            try {
                addSignRequest({
                    ...webviewDataSignRequestBase(
                        LEGACY_CHAIN_ID,
                        message.id,
                        webview,
                    ),
                    type: 'arbitrary-data',
                    sourceMetadata: metadata,
                    // Platform-observed origin, not page-asserted — gates the
                    // verification badge.
                    verifiedOrigin: sourceUrl ?? undefined,
                    data: parsed.data,
                })
            } catch (e) {
                sendErrorToWebview(
                    message.id,
                    JsonRpcErrorCode.InternalError,
                    e as Error,
                    webview,
                )
                // The dApp gets the protocol message above; the user gets
                // localized copy, with the raw detail logged (and appended
                // only when config.debugEnabled).
                showError(e, t('errors.signing.title'))
            }
        },
        [
            webview,
            hasRequiredParams,
            addSignRequest,
            allAccounts,
            sendInvalidSigner,
            sourceUrl,
            showError,
            t,
        ],
    )
}
