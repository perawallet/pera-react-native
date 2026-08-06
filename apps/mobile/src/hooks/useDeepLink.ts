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

import { Linking } from 'react-native'
import { useToast } from './useToast'
import { ALGO_ASSET_ID, logger } from '@perawallet/wallet-core-shared'
import { parseDeeplink } from './deeplink/parser'
import { isDevLocaleTourDeeplink } from './deeplink/dev-locale-tour-parser'
import { DeeplinkType } from './deeplink/types'
import {
    AccountTypes,
    useAccountsStore,
    useSelectedAccountAddress,
} from '@perawallet/wallet-core-accounts'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import { usePendingSignaturesSheet } from '@modules/multisig/hooks/usePendingSignaturesSheet'
import { useWalletConnectPairing } from '@modules/walletconnect/hooks/useWalletConnectPairing'
import {
    isValidAlgorandAddress,
    microAlgosToAlgos,
} from '@perawallet/wallet-core-blockchain'
import {
    getBiometricSecurityLevel,
    hasStrongBiometricOrCredential,
} from '@perawallet/wallet-core-security'
import { useLanguage } from './useLanguage'
import { useIsPeraCardEnabled } from './useIsPeraCardEnabled'
import { routeCapabilities } from '@routes/capabilities'
import { navigateToScreen } from './deeplink/navigateToScreen'
import {
    buildAccountDeeplink,
    buildDeeplink,
    type BuildDeeplinkInput,
} from './deeplink/builders'
import {
    useAssetOptInDeeplink,
    useBrowserDeeplink,
    useDiscoverPathDeeplink,
    useKeyregDeeplink,
    useLocaleTourDeeplink,
    usePeraWebImportDeeplink,
    useRecoverAddressDeeplink,
    useSendFundsDeeplink,
} from './deeplink/handlers'
import { useDeeplinkErrorHandler } from './deeplink/handlers/useDeeplinkErrorHandler'

type LinkSource = 'qr' | 'deeplink'

type UseDeepLinkResult = {
    isValidDeepLink: (url: string) => boolean
    handleDeepLink: (
        url: string,
        replaceCurrentScreen: boolean | undefined,
        source: LinkSource,
        onError?: () => void,
        onSuccess?: () => void,
        onConnectionError?: () => void,
    ) => Promise<void>
    parseDeeplink: typeof parseDeeplink
    buildAccountDeeplink: typeof buildAccountDeeplink
    buildDeeplink: (input: BuildDeeplinkInput) => string
}

export const useDeepLink = (): UseDeepLinkResult => {
    const { errorToast, infoToast } = useToast()
    const { setSelectedAccountAddress } = useSelectedAccountAddress()
    const { t } = useLanguage()
    const { pair } = useWalletConnectPairing()
    const { requestByType } = useBottomSheetStore()
    const { showSignRequest } = usePendingSignaturesSheet()
    const isPeraCardEnabled = useIsPeraCardEnabled()

    const recoverAddress = useRecoverAddressDeeplink()
    const openSendFunds = useSendFundsDeeplink()
    const submitKeyreg = useKeyregDeeplink()
    const openBrowser = useBrowserDeeplink()
    const openDiscoverPath = useDiscoverPathDeeplink()
    const handlePeraWebImport = usePeraWebImportDeeplink()
    const optInAsset = useAssetOptInDeeplink()
    const showError = useDeeplinkErrorHandler()
    const runLocaleTourStep = useLocaleTourDeeplink()

    const isValidDeepLink = (url: string): boolean => {
        if (isValidAlgorandAddress(url)) return true
        return parseDeeplink(url) !== null
    }

    /**
     * Runs a handler that opens its own bottom sheet, deliberately WITHOUT
     * awaiting it.
     *
     * Sheets render at the app root; the QR scanner is a native `<Modal>` in a
     * separate OS window above that root. The trailing `onSuccess?.()` below is
     * what dismisses the Modal, so awaiting a handler that itself waits on a
     * sheet pins the camera open on top of UI the user can neither see nor
     * reach — it reads as a freeze rather than an error (PERA-4744).
     *
     * Every sheet-opening case must dispatch through here instead of `await`.
     * WalletConnect is the one deliberate exception: the scanner observes its
     * outcome to re-arm on a rejected handshake.
     */
    const dispatchDetached = (
        run: Promise<unknown>,
        parsedType: string,
    ): void => {
        void run.catch(error => {
            logger.error(error as Error, { type: parsedType })
            showError({
                variant: 'generic',
                parsedType,
                error,
            })
        })
    }

    const handleDeepLink = async (
        url: string,
        replaceCurrentScreen: boolean = false,
        source: LinkSource,
        onError?: () => void,
        onSuccess?: () => void,
        onConnectionError?: () => void,
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

        try {
            if (isDevLocaleTourDeeplink(parsedData)) {
                await runLocaleTourStep(parsedData)
                onSuccess?.()
                return
            }

            switch (parsedData.type) {
                case DeeplinkType.ADD_CONTACT: {
                    // AddContact lives inside the nested Contacts stack, so it
                    // must be targeted via its parent route — a bare
                    // 'AddContact' on the root navigator is a silent no-op.
                    navigateToScreen(replaceCurrentScreen, 'Contacts', {
                        screen: 'AddContact',
                        params: {
                            address: parsedData.address,
                            label: parsedData.label,
                        },
                    })
                    break
                }

                case DeeplinkType.EDIT_CONTACT: {
                    navigateToScreen(replaceCurrentScreen, 'Contacts', {
                        screen: 'EditContact',
                        params: {
                            address: parsedData.address,
                            label: parsedData.label,
                        },
                    })
                    break
                }

                case DeeplinkType.ADD_WATCH_ACCOUNT: {
                    navigateToScreen(replaceCurrentScreen, 'AddAccount', {
                        screen: 'WatchAccount',
                        params: { prefillAddress: parsedData.address },
                    })
                    break
                }

                case DeeplinkType.RECEIVER_ACCOUNT_SELECTION: {
                    // Native invokes this from inside the Send destination
                    // picker; as a top-level deeplink we open Send fresh.
                    openSendFunds({ destination: parsedData.address })
                    break
                }

                case DeeplinkType.ADDRESS_ACTIONS: {
                    void requestByType(
                        'account-actions',
                        {
                            address: parsedData.address,
                            label: parsedData.label,
                        },
                        { enablePanDownToClose: true },
                    )
                    break
                }

                case DeeplinkType.ALGO_TRANSFER: {
                    openSendFunds({
                        assetId: ALGO_ASSET_ID,
                        destination: parsedData.receiverAddress,
                        // Wire is microAlgos; the store holds display units.
                        amount: parsedData.amount
                            ? microAlgosToAlgos(BigInt(parsedData.amount))
                            : undefined,
                        note: parsedData.note ?? parsedData.xnote,
                    })
                    break
                }

                case DeeplinkType.ASSET_TRANSFER: {
                    openSendFunds({
                        assetId: parsedData.assetId,
                        destination: parsedData.receiverAddress,
                        // Base units — InputScreen converts once the asset's
                        // `decimals` resolve.
                        amountBaseUnits: parsedData.amount,
                        note: parsedData.note ?? parsedData.xnote,
                    })
                    break
                }

                case DeeplinkType.KEYREG: {
                    await submitKeyreg(parsedData)
                    break
                }

                case DeeplinkType.RECOVER_ADDRESS: {
                    await recoverAddress({
                        mnemonic: parsedData.mnemonic,
                        source,
                        replaceCurrentScreen,
                    })
                    break
                }

                case DeeplinkType.WALLET_CONNECT: {
                    // `pair` constructs (native) or dispatches to offscreen
                    // (web) the pairing and resolves once the outcome is known
                    // — see `useWalletConnectPairing`.
                    //
                    // WC v1 bridges were sunset in mid-2024, so most public ones
                    // — including the legacy pera bridge older QR codes embed —
                    // now 404 without surfacing a sync throw. `pair` detects it
                    // by waiting briefly for a session_request or error.
                    const result = await pair(parsedData.uri)
                    if (result.type === 'connect-failed') {
                        logger.error('[deeplink/wc] connect failed', {
                            error: result.error,
                            uri: parsedData.uri,
                        })
                        showError({
                            variant: 'walletconnect',
                            parsedType: 'WALLET_CONNECT',
                            error: result.error,
                        })
                        onError?.()
                        return
                    }
                    if (result.type === 'error') {
                        // Handshake rejected — usually the QR was scanned on the
                        // wrong network. The provider toasts it, routed to the
                        // scanner's own notifier when open so it shows above the
                        // camera. Keep the scanner open and re-armed rather
                        // than closing it or firing the misleading "no
                        // response" error below.
                        onConnectionError?.()
                        return
                    }
                    if (result.type === 'timeout') {
                        showError({
                            variant: 'walletconnect',
                            parsedType: 'WALLET_CONNECT',
                            error: 'No response from the dApp. The session may be expired or the WalletConnect bridge may be unreachable.',
                        })
                        onError?.()
                        return
                    }
                    break
                }

                case DeeplinkType.ASSET_OPT_IN: {
                    // A bare `assetId` link carries no account, so the handler
                    // prompts the user to pick one; if the link names an
                    // address it's used directly. The handler also confirms,
                    // executes the opt-in, and surfaces already-opted-in /
                    // insufficient-balance as readable errors — it owns its own
                    // success/error toasts, so there is no outcome the scanner
                    // needs to observe. Detached (see `dispatchDetached`)
                    // because it awaits its own sheets.
                    dispatchDetached(
                        optInAsset({
                            assetId: parsedData.assetId,
                            address: parsedData.address,
                        }),
                        parsedData.type,
                    )
                    break
                }

                case DeeplinkType.ASSET_DETAIL:
                case DeeplinkType.ASSET_TRANSACTIONS: {
                    setSelectedAccountAddress(parsedData.address)
                    navigateToScreen(replaceCurrentScreen, 'TabBar', {
                        screen: 'Home',
                        params: {
                            screen: 'AssetDetails',
                            params: { assetId: parsedData.assetId },
                        },
                    })
                    break
                }

                case DeeplinkType.ASSET_INBOX: {
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
                }

                case DeeplinkType.INTERNAL_BROWSER:
                case DeeplinkType.DISCOVER_BROWSER: {
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
                }

                case DeeplinkType.DISCOVER_PATH: {
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
                }

                case DeeplinkType.CARDS: {
                    // Mirrors native's feature-gate: the PeraCard navigator is
                    // only registered when the remote-config flag is on, so a
                    // deeplink to it is a no-op while the feature is hidden.
                    // The `path` carries no destination yet (parity with the
                    // unused Staking path), so we land on the card intro.
                    // `onError` (not a bare return): the QR scanner locks
                    // until one of its callbacks fires — dropping the link
                    // silently would freeze it. Same below for SELL.
                    if (!isPeraCardEnabled || !routeCapabilities.peraCard) {
                        onError?.()
                        return
                    }
                    navigateToScreen(replaceCurrentScreen, 'PeraCard', {
                        screen: 'PeraCardIntro',
                    })
                    break
                }

                case DeeplinkType.STAKING: {
                    navigateToScreen(replaceCurrentScreen, 'Staking', {
                        path: parsedData.path,
                    })
                    break
                }

                case DeeplinkType.SWAP: {
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
                }

                case DeeplinkType.BUY: {
                    if (parsedData.address) {
                        setSelectedAccountAddress(parsedData.address)
                    }
                    navigateToScreen(replaceCurrentScreen, 'TabBar', {
                        screen: 'Fund',
                    })
                    break
                }

                case DeeplinkType.SELL: {
                    // Native Sell flows route through the Bidali gift-card
                    // marketplace (iOS BidaliFlowCoordinator, Android
                    // navToBidaliNavigation). Open the same Bidali sheet
                    // the Menu's "Buy Gift Card" panel button opens so we
                    // inherit the bidaliProvider JS bridge wiring.
                    // Same capability gate as that Menu button.
                    if (!routeCapabilities.giftCards) {
                        onError?.()
                        return
                    }
                    if (parsedData.address) {
                        setSelectedAccountAddress(parsedData.address)
                    }
                    void requestByType(
                        'bidali',
                        {},
                        {
                            size: 'modal',
                            enablePanDownToClose: true,
                            autoCreateContainer: false,
                        },
                    )
                    break
                }

                case DeeplinkType.ACCOUNT_DETAIL: {
                    setSelectedAccountAddress(parsedData.address)
                    navigateToScreen(replaceCurrentScreen, 'TabBar', {
                        screen: 'Home',
                        params: { screen: 'AccountDetails' },
                    })
                    break
                }

                case DeeplinkType.SHARED_ACCOUNT_IMPORT: {
                    // `onError` rather than a bare return, same as the
                    // PeraCard/Sell gates above: the QR scanner stays locked
                    // until one of its callbacks fires, so dropping the link
                    // silently would freeze it.
                    if (!routeCapabilities.sharedAccounts) {
                        onError?.()
                        return
                    }
                    navigateToScreen(replaceCurrentScreen, 'Multisig', {
                        screen: 'ImportSharedAccount',
                        params: { address: parsedData.address },
                    })
                    break
                }

                case DeeplinkType.SIGN_REQUEST: {
                    showSignRequest(parsedData.signRequestId)
                    break
                }

                case DeeplinkType.PERA_WEB_IMPORT: {
                    handlePeraWebImport({
                        data: parsedData,
                        source,
                        replaceCurrentScreen,
                    })
                    break
                }

                case DeeplinkType.LIQUID_AUTH: {
                    if (parsedData.variant === 'fido') {
                        // A FIDO request derives its P256 key from the HD root,
                        // so an HD account must exist — otherwise register has
                        // nothing to derive from and assert has nothing to sign
                        // with. Block the hand-off and explain rather than
                        // dead-ending in the OS flow.
                        const hasHDWallet = useAccountsStore
                            .getState()
                            .accounts.some(
                                account =>
                                    account.type === AccountTypes.hdWallet,
                            )
                        if (!hasHDWallet) {
                            void requestByType('passkey-hd-wallet-required', {})
                            // Close the QR scanner (when present) so the sheet,
                            // rendered at the root, becomes visible.
                            onError?.()
                            return
                        }

                        // A FIDO request (register or assert) needs device
                        // authentication the OS credential provider can use: a
                        // strong biometric OR a device credential (PIN / pattern
                        // / password). The provider is configured
                        // `strongOrCredential`, so any enrolled lock works; only
                        // a device with no screen lock at all dead-ends (register
                        // saves an unprotected key, assert can't satisfy the
                        // prompt). Block the hand-off and explain instead of
                        // failing silently.
                        const securityLevel = await getBiometricSecurityLevel()
                        if (!hasStrongBiometricOrCredential(securityLevel)) {
                            void requestByType('passkey-biometric-required', {})
                            // Close the QR scanner (when present) so the sheet,
                            // rendered at the root, becomes visible.
                            onError?.()
                            return
                        }

                        // Hand the fido:// URL back to the OS — iOS routes it
                        // to the registered AutoFill Credential Provider
                        // extension, Android to the Credential Manager.
                        // Mirrors pera-ios's QRScannerViewController.liquidAuth.
                        try {
                            await Linking.openURL(parsedData.url)
                        } catch (err) {
                            logger.error('Failed to open FIDO URL', {
                                error: err,
                                url: parsedData.sourceUrl,
                            })
                            errorToast(
                                t('errors.deeplink.invalid_url_title'),
                                t('errors.deeplink.invalid_url_body'),
                            )
                            onError?.()
                            return
                        }
                    } else {
                        // TODO(liquid-auth): wire the comms-protocol handler
                        // here once the signaling channel client lands. Until
                        // then we just log so devs can see scans coming in.
                        logger.info('liquid:// deeplink received', {
                            url: parsedData.sourceUrl,
                        })
                        infoToast(
                            t(
                                'settings.passkeys.liquid_protocol_placeholder_title',
                            ),
                            t(
                                'settings.passkeys.liquid_protocol_placeholder_body',
                            ),
                        )
                    }
                    break
                }

                case DeeplinkType.HOME:
                default: {
                    // Reset the Home tab to its stack root (AccountDetails) so a
                    // HOME deeplink actually returns home even when the user is
                    // deep in the Home stack (e.g. viewing an asset). Navigating
                    // to the root screen pops any screens pushed on top of it.
                    navigateToScreen(replaceCurrentScreen, 'TabBar', {
                        screen: 'Home',
                        params: { screen: 'AccountDetails' },
                    })
                    break
                }
            }

            onSuccess?.()
        } catch (error) {
            // Don't log the raw `url` here: a PERA_WEB_IMPORT payload carries
            // the 32-byte secretbox `encryptionKey` and a RECOVER_ADDRESS
            // payload carries a mnemonic. Log only the parsed type. The error
            // sheet likewise never receives the url — `showError` has no field
            // that could carry it.
            logger.error(error as Error, { type: parsedData.type })
            showError({
                variant: 'generic',
                parsedType: String(parsedData.type),
                error,
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
