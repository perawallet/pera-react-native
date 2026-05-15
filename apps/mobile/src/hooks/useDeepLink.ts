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

import { useToast } from './useToast'
import { logger } from '@perawallet/wallet-core-shared'
import { parseDeeplink } from './deeplink/parser'
import { DeeplinkType } from './deeplink/types'
import {
    useAccountsStore,
    useSelectedAccountAddress,
} from '@perawallet/wallet-core-accounts'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import { useWalletConnect } from '@perawallet/wallet-core-walletconnect'
import {
    isValidAlgorandAddress,
    microAlgosToAlgos,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { useLanguage } from './useLanguage'
import { navigateToScreen } from './deeplink/navigateToScreen'
import {
    buildAccountDeeplink,
    buildDeeplink,
    type BuildDeeplinkInput,
} from './deeplink/builders'
import {
    useBrowserDeeplink,
    useDiscoverPathDeeplink,
    useKeyregDeeplink,
    useRecoverAddressDeeplink,
    useSendFundsDeeplink,
} from './deeplink/handlers'

export type { BuildDeeplinkInput } from './deeplink/builders'

type LinkSource = 'qr' | 'deeplink'

type UseDeepLinkResult = {
    isValidDeepLink: (url: string) => boolean
    handleDeepLink: (
        url: string,
        replaceCurrentScreen: boolean | undefined,
        source: LinkSource,
        onError?: () => void,
        onSuccess?: () => void,
    ) => Promise<void>
    parseDeeplink: typeof parseDeeplink
    buildAccountDeeplink: typeof buildAccountDeeplink
    buildDeeplink: (input: BuildDeeplinkInput) => string
}

export const useDeepLink = (): UseDeepLinkResult => {
    const { showToast, errorToast, infoToast } = useToast()
    const { setSelectedAccountAddress } = useSelectedAccountAddress()
    const { network } = useNetwork()
    const { t } = useLanguage()
    const { connect } = useWalletConnect(network)
    const { requestByType } = useBottomSheetStore()

    const recoverAddress = useRecoverAddressDeeplink()
    const openSendFunds = useSendFundsDeeplink()
    const submitKeyreg = useKeyregDeeplink()
    const openBrowser = useBrowserDeeplink()
    const openDiscoverPath = useDiscoverPathDeeplink()

    const isValidDeepLink = (url: string): boolean => {
        if (isValidAlgorandAddress(url)) return true
        return parseDeeplink(url) !== null
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
                    navigateToScreen(replaceCurrentScreen, 'AddAccount', {
                        screen: 'WatchAccount',
                        params: { prefillAddress: parsedData.address },
                    })
                    break

                case DeeplinkType.RECEIVER_ACCOUNT_SELECTION:
                    // Mirrors native: capture the address as the receiver and
                    // open the Send flow. Native invokes this from inside the
                    // Send destination picker; reaching it as a top-level
                    // deeplink falls back to opening Send fresh.
                    openSendFunds({ destination: parsedData.address })
                    break

                case DeeplinkType.ADDRESS_ACTIONS:
                    requestByType('account-actions', {
                        address: parsedData.address,
                        label: parsedData.label,
                    })
                    break

                case DeeplinkType.ALGO_TRANSFER:
                    openSendFunds({
                        assetId: '0',
                        destination: parsedData.receiverAddress,
                        // ALGO amounts arrive in microAlgos; the store holds
                        // the display value (ALGOs) so convert here.
                        amount: parsedData.amount
                            ? microAlgosToAlgos(BigInt(parsedData.amount))
                            : undefined,
                        note: parsedData.note ?? parsedData.xnote,
                    })
                    break

                case DeeplinkType.ASSET_TRANSFER:
                    openSendFunds({
                        assetId: parsedData.assetId,
                        destination: parsedData.receiverAddress,
                        // Asset amounts are in base units. The InputScreen
                        // converts to display units once the asset's
                        // `decimals` resolve via the assets query.
                        amountBaseUnits: parsedData.amount,
                        note: parsedData.note ?? parsedData.xnote,
                    })
                    break

                case DeeplinkType.KEYREG:
                    await submitKeyreg(parsedData)
                    break

                case DeeplinkType.RECOVER_ADDRESS:
                    await recoverAddress({
                        mnemonic: parsedData.mnemonic,
                        source,
                        replaceCurrentScreen,
                    })
                    break

                case DeeplinkType.WALLET_CONNECT:
                    // `connect` registers listeners + opens the bridge socket
                    // synchronously; the dApp's session_request lands on the
                    // listener and triggers WalletConnectProvider's overlay.
                    // Awaited so any handshake errors surface here rather
                    // than vanishing into an unhandled promise rejection.
                    try {
                        await connect({
                            connection: { uri: parsedData.uri },
                        })
                    } catch (error) {
                        logger.error('WalletConnect deeplink connect failed', {
                            error,
                            uri: parsedData.uri,
                        })
                        errorToast(
                            t('errors.deeplink.invalid_url_title'),
                            t('errors.deeplink.invalid_url_body'),
                        )
                        onError?.()
                        return
                    }
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
                            params: { assetId: parsedData.assetId },
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
                    if (
                        !openBrowser({
                            url: parsedData.url,
                            sourceUrl: parsedData.sourceUrl,
                            onError,
                        })
                    ) {
                        return
                    }
                    break

                case DeeplinkType.DISCOVER_PATH:
                    if (
                        !openDiscoverPath({
                            path: parsedData.path,
                            sourceUrl: parsedData.sourceUrl,
                            replaceCurrentScreen,
                            onError,
                        })
                    ) {
                        return
                    }
                    break

                case DeeplinkType.CARDS:
                    // TODO: Navigate to cards screen
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
                    // Native Sell flows route through the Bidali gift-card
                    // marketplace (iOS BidaliFlowCoordinator, Android
                    // navToBidaliNavigation). Open the same Bidali sheet
                    // the Menu's "Buy Gift Card" panel button opens so we
                    // inherit the bidaliProvider JS bridge wiring.
                    if (parsedData.address) {
                        setSelectedAccountAddress(parsedData.address)
                    }
                    requestByType(
                        'bidali',
                        {},
                        {
                            size: 'lg',
                            enablePanDownToClose: true,
                            autoCreateContainer: false,
                        },
                    )
                    break

                case DeeplinkType.ACCOUNT_DETAIL:
                    setSelectedAccountAddress(parsedData.address)
                    navigateToScreen(replaceCurrentScreen, 'TabBar', {
                        screen: 'Home',
                        params: { screen: 'AccountDetails' },
                    })
                    break

                case DeeplinkType.SHARED_ACCOUNT_IMPORT:
                    // TODO(multisig PR 1): navigate to shared-account import flow
                    infoToast(
                        'Shared Account Import',
                        'Shared account import not implemented yet',
                    )
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
            logger.error(error as Error, { url, parsedType: parsedData.type })
            // guardrails-ignore-next-line no-error-toast-in-catch reason: deeplink-failure surface to user is required for visibility
            errorToast(
                t('errors.deeplink.invalid_url_title'),
                t('errors.deeplink.invalid_url_body'),
            )
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
