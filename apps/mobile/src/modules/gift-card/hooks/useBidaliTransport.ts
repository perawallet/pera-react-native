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

import { useCallback, useMemo, useRef } from 'react'
import { Linking } from 'react-native'
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import type {
    AccountBalances,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    isValidAlgorandAddress,
    useAlgorandClient,
    useNetwork,
    displayUnitsToBaseUnits,
} from '@perawallet/wallet-core-blockchain'
import { ALGO_ASSET, getKnownAssetId } from '@perawallet/wallet-core-assets'
import {
    useSigningRequest,
    type TransactionSignRequest,
} from '@perawallet/wallet-core-signing'
import {
    isAlgoAssetId,
    ALGO_ASSET_ID,
    generateOrderedUniqueId,
    logger,
    type Optional,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import type WebView from 'react-native-webview'
import { Decimal } from 'decimal.js'
import { sendBidaliEvent } from './bidali-events'

const SUPPORTED_CURRENCIES = ['algorand', 'usdcalgorand']
const SUPPORTED_CURRENCIES_JSON = JSON.stringify(SUPPORTED_CURRENCIES)

type CurrencyInfo = {
    assetId: string
    decimals: number
}

const getCurrencyInfo = (
    protocol: string,
    network: 'mainnet' | 'testnet',
): Nullable<CurrencyInfo> => {
    switch (protocol) {
        case 'algorand': {
            return { assetId: ALGO_ASSET_ID, decimals: ALGO_ASSET.decimals }
        }
        case 'testusdcalgorand':
        case 'usdcalgorand': {
            return {
                assetId: getKnownAssetId('USDC', network),
                decimals: ALGO_ASSET.decimals, //USDC has same number of decimals as algo
            }
        }
        default: {
            return null
        }
    }
}

// Selects the balances object the Bidali provider surface embeds: the
// selected account's ALGO/USDC amounts, keyed by Bidali's currency protocol
// names. Exported so bidali-url.web.ts (Task 4) can stamp the identical
// shape onto the web iframe URL instead of duplicating this math.
export const computeBidaliBalances = (
    account: Optional<WalletAccount>,
    balances: AccountBalances,
    network: 'mainnet' | 'testnet',
): Record<string, string> => {
    const balance = balances.get(account?.address ?? '')

    const algoBalance = balance?.assetBalances.find(a =>
        isAlgoAssetId(a.assetId),
    )?.amount
    const usdcBalance = balance?.assetBalances.find(
        a => a.assetId === getKnownAssetId('USDC', network),
    )?.amount

    const isTestnet = network === 'testnet'
    return {
        algorand: algoBalance?.toString() ?? '0',
        [isTestnet ? 'testusdcalgorand' : 'usdcalgorand']:
            usdcBalance?.toString() ?? '0',
    }
}

const buildBidaliProviderJS = (apiKey: string, balances: string): string => {
    return `
        (function() {
            function sendRPC(method, params) {
                if (!window.ReactNativeWebView) return;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    jsonrpc: '2.0',
                    method: method,
                    params: params,
                    id: 'bidali-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
                }));
            }

            window.bidaliProvider = {
                key: '${apiKey}',
                name: 'perawallet',
                paymentCurrencies: ${SUPPORTED_CURRENCIES_JSON},
                balances: ${balances},

                onPaymentRequest: function(req) {
                    if (req == null || typeof req !== 'object') return;
                    sendRPC('bidaliPaymentRequest', {
                        address: req.address,
                        amount: req.amount,
                        protocol: req.protocol || req.currencyProtocol,
                        extraId: req.extraId,
                        chargeId: req.chargeId,
                        description: req.description
                    });
                },

                openUrl: function(urlOrObj) {
                    var url = typeof urlOrObj === 'object' && urlOrObj !== null ? urlOrObj.url : urlOrObj;
                    if (typeof url !== 'string') return;
                    sendRPC('openUrl', { url: url });
                }
            };
        })();
        true;
    `
}

type BidaliRPCMessage = {
    jsonrpc: '2.0'
    method: string
    params?: Record<string, unknown>
    id: string
}

const isBidaliRPC = (data: unknown): data is BidaliRPCMessage => {
    if (data == null || typeof data !== 'object') return false
    const msg = data as Record<string, unknown>
    return (
        msg.jsonrpc === '2.0' &&
        typeof msg.method === 'string' &&
        typeof msg.id === 'string' &&
        msg.id.startsWith('bidali-')
    )
}

type UseBidaliTransportResult = {
    providerJS: string
    handleMessage: (data: unknown) => void
    webviewRef: React.RefObject<Nullable<WebView>>
}

export const useBidaliTransport = (
    account: Optional<WalletAccount>,
    balances: AccountBalances,
): UseBidaliTransportResult => {
    const { network } = useNetwork()
    const { t } = useLanguage()
    const algokit = useAlgorandClient()
    const { addSignRequest } = useSigningRequest()
    const webviewRef = useRef<Nullable<WebView>>(null)

    const providerJS = useMemo(() => {
        const balanceMap = computeBidaliBalances(account, balances, network)

        return buildBidaliProviderJS(
            getNetworkConfig(network).bidaliApiKey,
            JSON.stringify(balanceMap),
        )
    }, [network, account, balances])

    const handlePaymentRequest = useCallback(
        async (params: Record<string, unknown>) => {
            const { address, amount, protocol, extraId } = params

            if (!account) {
                logger.warn('Bidali: no selected account')
                return
            }

            if (
                typeof address !== 'string' ||
                !isValidAlgorandAddress(address) ||
                typeof amount !== 'string' ||
                typeof protocol !== 'string'
            ) {
                logger.warn('Bidali: invalid param', {
                    amount,
                    protocol,
                    address,
                })
                return
            }
            let numericAmount: Decimal
            try {
                numericAmount = new Decimal(amount)
            } catch {
                logger.warn('Bidali: invalid amount', { amount })
                return
            }
            if (
                !numericAmount.isFinite() ||
                numericAmount.isNegative() ||
                numericAmount.isZero()
            ) {
                logger.warn('Bidali: invalid amount', { amount })
                return
            }

            const currencyInfo = getCurrencyInfo(protocol, network)
            if (!currencyInfo) {
                logger.warn('Bidali: unsupported protocol', { protocol })
                return
            }

            const note =
                typeof extraId === 'string' && extraId.length > 0
                    ? extraId
                    : undefined

            const sender = account.address
            const baseAmount = BigInt(
                displayUnitsToBaseUnits(amount, currencyInfo.decimals).toFixed(
                    0,
                ),
            )

            try {
                const composer = algokit.newGroup()

                if (isAlgoAssetId(currencyInfo.assetId)) {
                    composer.addPayment({
                        sender,
                        receiver: address,
                        amount: baseAmount.microAlgo(),
                        note,
                    })
                } else {
                    composer.addAssetTransfer({
                        sender,
                        receiver: address,
                        assetId: BigInt(currencyInfo.assetId),
                        amount: baseAmount,
                        note,
                    })
                }

                const built = await composer.buildTransactions()

                addSignRequest({
                    id: generateOrderedUniqueId(),
                    type: 'transactions',
                    transport: 'algod',
                    sourceType: 'gift-card',
                    txs: built.transactions,
                    sourceMetadata: {
                        name: t('giftCard.signing.source_name'),
                        description: t('giftCard.signing.source_description'),
                        url: getNetworkConfig(network).bidaliBaseUrl,
                    },
                    approve: async () => {
                        sendBidaliEvent(webviewRef, 'paymentSent')
                    },
                    reject: async () => {
                        sendBidaliEvent(webviewRef, 'paymentCancelled')
                    },
                    error: async () => {
                        sendBidaliEvent(webviewRef, 'paymentCancelled')
                    },
                } as TransactionSignRequest)
            } catch (e) {
                logger.error('Bidali: failed to build transaction', {
                    error: e,
                })
                sendBidaliEvent(webviewRef, 'paymentCancelled')
            }
        },
        [account, network, algokit, addSignRequest, t],
    )

    const handleOpenUrl = useCallback((params: Record<string, unknown>) => {
        const { url } = params

        if (
            typeof url !== 'string' ||
            url.length === 0 ||
            (!url.startsWith('https://') && !url.startsWith('http://'))
        ) {
            logger.warn('Bidali: invalid url parameter', { url })
            return
        }

        void Linking.openURL(url)
    }, [])

    const handleMessage = useCallback(
        (data: unknown) => {
            if (!isBidaliRPC(data)) return

            const { method, params } = data

            if (!params) {
                logger.warn('Bidali: message missing params', { method })
                return
            }

            switch (method) {
                case 'bidaliPaymentRequest': {
                    void handlePaymentRequest(params)
                    break
                }
                case 'openUrl': {
                    handleOpenUrl(params)
                    break
                }
                default: {
                    logger.warn('Bidali: unknown method', { method })
                }
            }
        },
        [handlePaymentRequest, handleOpenUrl],
    )

    return { providerJS, handleMessage, webviewRef }
}
