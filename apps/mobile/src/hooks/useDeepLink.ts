/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useToast } from './useToast'
import { logger } from '@perawallet/wallet-core-shared'
import { parseDeeplink } from './deeplink/parser'
import { DeeplinkType } from './deeplink/types'
import { useSigningRequest } from '@perawallet/wallet-core-blockchain'
import {
    useSelectedAccountAddress,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useWebView } from './usePeraWebviewInterface'
import { v7 as uuidv7 } from 'uuid'
import { useEffect, useRef } from 'react'
import { Linking } from 'react-native'
import { useWalletConnect } from '@perawallet/wallet-core-walletconnect'
import { ALGORAND_SCHEME } from './deeplink/arc90-parser'

type LinkSource = 'qr' | 'deeplink'

/**
 * A hook for handling and validating Pera Wallet deep links and QR codes.
 * Supports various actions like adding contacts, asset transfers, and WalletConnect sessions.
 *
 * @returns Deep linking state and handling methods
 *
 * @example
 * const { handleDeepLink } = useDeepLink()
 * handleDeepLink(url, false, 'deeplink')
 */
export const useDeepLink = () => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { showToast } = useToast()
    const { addSignRequest } = useSigningRequest()
    const { setSelectedAccountAddress } = useSelectedAccountAddress()
    const { pushWebView } = useWebView()
    const { connect } = useWalletConnect()

    const isValidDeepLink = (url: string, source: LinkSource): boolean => {
        logger.debug('Validating deeplink', { url, source })
        const parsed = parseDeeplink(url)
        return parsed !== null
    }

    const infoPost = (title: string, body: string) => {
        showToast({
            title,
            body,
            type: 'info',
        })
    }

    const navigateToScreen = (
        replaceCurrentScreen: boolean,
        screenName: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        params?: any,
    ) => {
        if (replaceCurrentScreen) {
            navigation.replace(screenName, params)
        } else {
            navigation.navigate(screenName, params)
        }
    }

    const buildAccountDeeplink = (account: WalletAccount) => {
        return `${ALGORAND_SCHEME}${account.address}`
    }

    const handleDeepLink = async (
        url: string,
        replaceCurrentScreen: boolean = false,
        source: LinkSource,
        onError?: () => void,
        onSuccess?: () => void,
    ) => {
        const parsedData = parseDeeplink(url)

        if (!parsedData) {
            showToast({
                title: 'Invalid Link',
                body: 'The detected link does not appear to be valid',
                type: 'error',
            })
            onError?.()
            return
        }

        logger.debug('Parsed deeplink data:', { parsedData })

        try {
            // Navigate based on deeplink type
            switch (parsedData.type) {
                case DeeplinkType.ADD_CONTACT:
                    navigateToScreen(replaceCurrentScreen, 'AddContact', {
                        address: parsedData.address,
                        label: parsedData.label,
                    })
                    break

                case DeeplinkType.EDIT_CONTACT:
                    navigateToScreen(replaceCurrentScreen, 'EditContact', {
                        address: parsedData.address,
                        label: parsedData.label,
                    })
                    break

                case DeeplinkType.ADD_WATCH_ACCOUNT:
                    // TODO: Navigate to watch account addition screen
                    infoPost(
                        'Add Watch Account',
                        'Watch account screen not implemented yet',
                    )
                    break

                case DeeplinkType.RECEIVER_ACCOUNT_SELECTION:
                    // TODO: Navigate to receiver account selection
                    infoPost(
                        'Receiver Selection',
                        'Receiver account selection not implemented yet',
                    )
                    break

                case DeeplinkType.ADDRESS_ACTIONS:
                    // TODO: Show address actions modal/screen
                    infoPost(
                        'Address Actions',
                        'Address actions screen not implemented yet',
                    )
                    break

                case DeeplinkType.ALGO_TRANSFER:
                    // TODO: We need to use a proper transaction construction method here and
                    //navigate somewhere other than the qr code scanner.
                    addSignRequest({
                        id: uuidv7(),
                        type: 'transactions',
                        transport: 'algod',
                        txs: [],
                    })
                    break

                case DeeplinkType.ASSET_TRANSFER:
                    // TODO: We need to use a proper transaction construction method here and
                    //navigate somewhere other than the qr code scanner.
                    addSignRequest({
                        id: uuidv7(),
                        type: 'transactions',
                        transport: 'algod',
                        txs: [],
                    })
                    break

                case DeeplinkType.KEYREG:
                    // TODO: Handle the keyreg transaction construction and do something useful with it
                    infoPost(
                        'Key Registration',
                        'Keyreg screen not implemented yet',
                    )
                    break

                case DeeplinkType.RECOVER_ADDRESS:
                    // Only handle recovery from QR deeplinks
                    if (source !== 'qr') {
                        return
                    }
                    // TODO: Navigate to account recovery screen
                    // navigation.navigate('RecoverAccount', { mnemonic: parsedData.mnemonic })
                    infoPost(
                        'Recover Address',
                        'Account recovery not implemented yet',
                    )
                    break

                case DeeplinkType.WALLET_CONNECT:
                    connect({
                        connection: {
                            uri: parsedData.uri,
                        },
                    })
                    break

                case DeeplinkType.ASSET_OPT_IN:
                    // TODO: We need to use a proper transaction construction method here and
                    //navigate somewhere other than the qr code scanner.
                    addSignRequest({
                        id: uuidv7(),
                        type: 'transactions',
                        transport: 'algod',
                        txs: [],
                    })
                    break

                case DeeplinkType.ASSET_DETAIL:
                case DeeplinkType.ASSET_TRANSACTIONS:
                    setSelectedAccountAddress(parsedData.address)
                    navigateToScreen(replaceCurrentScreen, 'AssetDetail', {
                        assetId: parsedData.assetId,
                    })
                    break

                case DeeplinkType.ASSET_INBOX:
                    // TODO: Navigate to asset inbox screen
                    infoPost(
                        'Asset Inbox',
                        'Asset inbox screen not implemented yet',
                    )
                    break

                case DeeplinkType.INTERNAL_BROWSER:
                case DeeplinkType.DISCOVER_BROWSER:
                    pushWebView({ id: uuidv7(), url: parsedData.url })
                    break

                case DeeplinkType.DISCOVER_PATH:
                    navigateToScreen(replaceCurrentScreen, 'TabBar', {
                        screen: 'Discover',
                        params: { path: parsedData.path },
                    })
                    break

                case DeeplinkType.CARDS:
                    // TODO: Navigate to cards screen
                    // navigation.navigate('Cards', { path: parsedData.path })
                    infoPost('Cards', 'Cards screen not implemented yet')
                    break

                case DeeplinkType.STAKING:
                    navigateToScreen(replaceCurrentScreen, 'Staking', {
                        path: parsedData.path,
                    })
                    break

                case DeeplinkType.SWAP:
                    if (parsedData.address) {
                        setSelectedAccountAddress(parsedData.address)
                    }
                    navigateToScreen(replaceCurrentScreen, 'TabBar', {
                        screen: 'Swap',
                        params: {
                            assetInId: parsedData.assetInId,
                            assetOutId: parsedData.assetOutId,
                        },
                    })
                    break

                case DeeplinkType.BUY:
                    if (parsedData.address) {
                        setSelectedAccountAddress(parsedData.address)
                    }
                    navigateToScreen(replaceCurrentScreen, 'TabBar', {
                        screen: 'Fund',
                    })
                    break

                case DeeplinkType.SELL:
                    //TODO implement sell
                    infoPost('Sell', 'Sell screen not implemented yet')
                    break

                case DeeplinkType.ACCOUNT_DETAIL:
                    setSelectedAccountAddress(parsedData.address)
                    navigateToScreen(replaceCurrentScreen, 'TabBar', {
                        screen: 'AccountDetail',
                    })
                    break

                case DeeplinkType.HOME:
                default:
                    navigateToScreen(replaceCurrentScreen, 'TabBar', {
                        screen: 'Home',
                    })
                    break
            }

            logger.debug('Deeplink: Handled successfully', { url, parsedData })
            onSuccess?.()
        } catch (error) {
            logger.error(error as Error, { url })
            showToast({
                title: 'Navigation Error',
                body: 'Could not navigate to the requested screen',
                type: 'error',
            })
            onError?.()
        }
    }

    return {
        isValidDeepLink,
        handleDeepLink,
        parseDeeplink,
        buildAccountDeeplink,
    }
}

/**
 * A listener hook that monitors the system for incoming deep links.
 * Handles both cold starts (initial URL) and warm starts (URL events).
 *
 * @example
 * // In RootComponent
 * useDeeplinkListener()
 */
export const useDeeplinkListener = () => {
    const { handleDeepLink, isValidDeepLink } = useDeepLink()
    const hasHandledInitialUrl = useRef(false)

    useEffect(() => {
        const handleInitialUrl = async () => {
            try {
                const initialUrl = await Linking.getInitialURL()

                if (initialUrl && !hasHandledInitialUrl.current) {
                    hasHandledInitialUrl.current = true
                    logger.debug('Deeplink: Initial URL (cold start)', {
                        initialUrl,
                    })

                    if (isValidDeepLink(initialUrl, 'deeplink')) {
                        // Small delay to ensure navigation is ready
                        setTimeout(() => {
                            handleDeepLink(initialUrl, false, 'deeplink')
                        }, 500)
                    }
                }
            } catch (error) {
                logger.debug('Deeplink: Error getting initial URL', { error })
            }
        }

        handleInitialUrl()

        const subscription = Linking.addEventListener('url', event => {
            logger.debug('Deeplink: URL event (warm start)', { url: event.url })

            if (isValidDeepLink(event.url, 'deeplink')) {
                handleDeepLink(event.url, false, 'deeplink')
            }
        })

        return () => {
            subscription.remove()
        }
    }, [handleDeepLink, isValidDeepLink])
}
