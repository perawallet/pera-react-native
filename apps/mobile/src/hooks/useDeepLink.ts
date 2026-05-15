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

import { StackActions } from '@react-navigation/native'
import { useToast } from './useToast'
import { navigationRef } from '@routes/navigationRef'
import { generateOrderedUniqueId, logger } from '@perawallet/wallet-core-shared'
import { parseDeeplink } from './deeplink/parser'
import { DeeplinkType } from './deeplink/types'
import {
    resolveImportAccountType,
    useAccountsStore,
    useImportAccount,
    useSelectedAccountAddress,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import { useMarkMnemonicBackupComplete } from '@perawallet/wallet-core-backup'
import { usePeraWebImportFlowStore } from '@modules/onboarding/hooks'
import { useWebView } from '@modules/webview/hooks/useWebViewStore'
import {
    isSafeBrowserUrl,
    isSafeRelativePath,
} from '@modules/webview/hooks/handlers'
import { useWalletConnect } from '@perawallet/wallet-core-walletconnect'
import { ALGORAND_SCHEME } from './deeplink/arc90-parser'
import {
    isValidAlgorandAddress,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { useLanguage } from './useLanguage'

type LinkSource = 'qr' | 'deeplink'

export type BuildDeeplinkInput = {
    type: typeof DeeplinkType.SHARED_ACCOUNT_IMPORT
    address: string
}

export const useDeepLink = () => {
    const { showToast, errorToast, infoToast } = useToast()
    const { setSelectedAccountAddress } = useSelectedAccountAddress()
    const { pushWebView } = useWebView()
    const { network } = useNetwork()
    const { t } = useLanguage()
    const { connect } = useWalletConnect(network)
    const { requestByType } = useBottomSheetStore()
    const importAccount = useImportAccount()
    const markBackupComplete = useMarkMnemonicBackupComplete()

    const isValidDeepLink = (url: string): boolean => {
        if (isValidAlgorandAddress(url)) {
            return true
        }
        const parsed = parseDeeplink(url)
        return parsed !== null
    }

    const navigateToScreen = (
        replaceCurrentScreen: boolean,
        screenName: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        params?: any,
    ) => {
        if (!navigationRef.isReady()) return
        if (replaceCurrentScreen) {
            navigationRef.dispatch(StackActions.replace(screenName, params))
        } else {
            navigationRef.navigate(screenName, params)
        }
    }

    const buildAccountDeeplink = (account: WalletAccount) => {
        return `${ALGORAND_SCHEME}${account.address}`
    }

    const handleRecoverAddressDeeplink = async ({
        mnemonic,
        source,
        replaceCurrentScreen,
    }: {
        mnemonic: string
        source: LinkSource
        replaceCurrentScreen: boolean
    }) => {
        if (source !== 'qr') return

        const resolved = resolveImportAccountType(mnemonic)
        if (!resolved.success) return

        try {
            const result = await importAccount({
                mnemonic,
                type: resolved.accountType,
            })

            if (result.type === 'hdWallet' && 'walletKeyId' in result) {
                navigateToScreen(replaceCurrentScreen, 'AddAccount', {
                    screen: 'SearchAccounts',
                    params: {
                        mode: 'import',
                        walletKeyId: result.walletKeyId,
                        derivationType: result.derivationType,
                    },
                })
            } else {
                markBackupComplete(result as WalletAccount)
                navigateToScreen(replaceCurrentScreen, 'AddAccount', {
                    screen: 'SearchAccounts',
                    params: {
                        account: result as WalletAccount,
                    },
                })
            }
        } catch (error) {
            logger.error('Deeplink import failed', { error })
        }
    }

    const buildDeeplink = (input: BuildDeeplinkInput): string => {
        switch (input.type) {
            case DeeplinkType.SHARED_ACCOUNT_IMPORT: {
                const encodedAddress = encodeURIComponent(input.address)
                return `perawallet://app/shared-account-import/?address=${encodedAddress}`
            }
        }
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
            errorToast(
                t('errors.deeplink.invalid_url_title'),
                t('errors.deeplink.invalid_url_body'),
            )
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
                    infoToast(
                        'Add Watch Account',
                        'Watch account screen not implemented yet',
                    )
                    break

                case DeeplinkType.RECEIVER_ACCOUNT_SELECTION:
                    infoToast(
                        'Receiver Selection',
                        'Receiver account selection not implemented yet',
                    )
                    break

                case DeeplinkType.ADDRESS_ACTIONS:
                    infoToast(
                        'Address Actions',
                        'Address actions screen not implemented yet',
                    )
                    break

                case DeeplinkType.ALGO_TRANSFER:
                    infoToast(
                        'Algo Transfer',
                        'Algo transfer screen not implemented yet',
                    )
                    break

                case DeeplinkType.ASSET_TRANSFER:
                    infoToast(
                        'Asset Transfer',
                        'Asset transfer screen not implemented yet',
                    )
                    break

                case DeeplinkType.KEYREG:
                    // TODO: Handle the keyreg transaction construction and do something useful with it
                    infoToast(
                        'Key Registration',
                        'Keyreg screen not implemented yet',
                    )
                    break

                case DeeplinkType.RECOVER_ADDRESS:
                    await handleRecoverAddressDeeplink({
                        mnemonic: parsedData.mnemonic,
                        source,
                        replaceCurrentScreen,
                    })
                    break

                case DeeplinkType.WALLET_CONNECT:
                    connect({
                        connection: {
                            uri: parsedData.uri,
                        },
                    })
                    break

                case DeeplinkType.ASSET_OPT_IN: {
                    // Prefer the address explicitly carried by the deep link;
                    // fall back to the currently selected account so a bare
                    // `assetId` link still has somewhere to opt in.
                    const accountAddress =
                        parsedData.address ??
                        useAccountsStore.getState().selectedAccountAddress
                    if (!accountAddress) {
                        errorToast(
                            t('errors.deeplink.title'),
                            t('errors.deeplink.no_account'),
                        )
                        break
                    }
                    requestByType('asset-opt-in', {
                        assetId: parsedData.assetId,
                        accountAddress,
                    })
                    break
                }

                case DeeplinkType.ASSET_DETAIL:
                case DeeplinkType.ASSET_TRANSACTIONS:
                    setSelectedAccountAddress(parsedData.address)
                    navigateToScreen(replaceCurrentScreen, 'TabBar', {
                        screen: 'Home',
                        params: {
                            screen: 'AssetDetails',
                            params: {
                                assetId: parsedData.assetId,
                            },
                        },
                    })
                    break

                case DeeplinkType.ASSET_INBOX:
                    navigateToScreen(false, 'Messages', {
                        screen: 'AssetTransferRequests',
                        params: {
                            item: {
                                address: parsedData.address,
                                inboxAddress: parsedData.address,
                                requestCount: 1,
                            },
                        },
                    })
                    break

                case DeeplinkType.INTERNAL_BROWSER:
                case DeeplinkType.DISCOVER_BROWSER:
                    if (!isSafeBrowserUrl(parsedData.url)) {
                        logger.warn(
                            'Blocked deeplink WebView push for unsafe URL',
                            {
                                url: parsedData.url,
                                sourceUrl: parsedData.sourceUrl,
                            },
                        )
                        errorToast(
                            t('errors.deeplink.invalid_url_title'),
                            t('errors.deeplink.invalid_url_body'),
                        )
                        onError?.()
                        return
                    }
                    pushWebView({
                        id: generateOrderedUniqueId(),
                        url: parsedData.url,
                    })
                    break

                case DeeplinkType.DISCOVER_PATH:
                    if (
                        parsedData.path !== undefined &&
                        !isSafeRelativePath(parsedData.path)
                    ) {
                        logger.warn(
                            'Blocked DISCOVER_PATH deeplink with unsafe path',
                            {
                                path: parsedData.path,
                                sourceUrl: parsedData.sourceUrl,
                            },
                        )
                        errorToast(
                            t('errors.deeplink.invalid_url_title'),
                            t('errors.deeplink.invalid_url_body'),
                        )
                        onError?.()
                        return
                    }
                    navigateToScreen(replaceCurrentScreen, 'TabBar', {
                        screen: 'Discover',
                        params: { path: parsedData.path },
                    })
                    break

                case DeeplinkType.CARDS:
                    // TODO: Navigate to cards screen
                    // navigation.navigate('Cards', { path: parsedData.path })
                    infoToast('Cards', 'Cards screen not implemented yet')
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
                    infoToast('Sell', 'Sell screen not implemented yet')
                    break

                case DeeplinkType.ACCOUNT_DETAIL:
                    setSelectedAccountAddress(parsedData.address)
                    navigateToScreen(replaceCurrentScreen, 'TabBar', {
                        screen: 'AccountDetail',
                    })
                    break

                case DeeplinkType.SHARED_ACCOUNT_IMPORT:
                    // TODO(multisig PR 1): navigate to shared-account import flow
                    infoToast(
                        'Shared Account Import',
                        'Shared account import not implemented yet',
                    )
                    break

                case DeeplinkType.PERA_WEB_IMPORT:
                    if (source !== 'qr') {
                        logger.warn(
                            'Pera Web import ignored — only supported via QR scan',
                            { source },
                        )
                        break
                    }
                    usePeraWebImportFlowStore.getState().setQr({
                        backupId: parsedData.backupId,
                        encryptionKey: parsedData.encryptionKey,
                    })
                    navigateToScreen(replaceCurrentScreen, 'AddAccount', {
                        screen: 'PeraWebImportLoading',
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
            // guardrails-ignore-next-line no-error-toast-in-catch reason: bespoke deeplink-failure copy preserved verbatim
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
        buildDeeplink,
    }
}
