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

import { useCallback, useRef } from 'react'
import { Linking } from 'react-native'
import { logger } from '@perawallet/wallet-core-shared'
import { useToast } from '@hooks/useToast'
import { useNativeAsset } from '@perawallet/wallet-core-assets'
import {
    buildDeeplink,
    DeeplinkType,
    isNotificationAllowedDeeplinkType,
    isPeraOwnedDeeplink,
    linkTargetOf,
    resolveChainDeeplink,
    type BuildDeeplinkInput,
    type LinkSource,
} from '@perawallet/wallet-core-deeplinks'
import { parseDeeplink } from '../parser'
import { isDevLocaleTourDeeplink } from '../dev-locale-tour-parser'
import type { AppDeeplink } from '../types'
import {
    findAccountByAddressOn,
    findAccountByAnyChainAddress,
    hdIndexOf,
    useAccountsStore,
    useSelectedAccountId,
} from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useSwapChainResolver } from '@perawallet/wallet-core-swaps'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import { BIDALI_SHEET_OPTIONS } from '@modules/gift-card'
import { usePendingSignaturesSheet } from '@modules/multisig'
import {
    getBiometricSecurityLevel,
    hasStrongBiometricOrCredential,
} from '@perawallet/wallet-core-security'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useIsPeraCardEnabled } from '@hooks/useIsPeraCardEnabled'
import { useIsGiftCardsEnabled } from '@hooks/useIsGiftCardsEnabled'
import { useCapabilityCheck } from '@hooks/useCapability'
import { navigateHome, navigateToScreen } from '../navigateToScreen'
import { capabilityRequirementForDeeplink } from '../capability-policy'
import {
    useAssetOptInDeeplink,
    useBrowserDeeplink,
    useDiscoverPathDeeplink,
    useKeyregDeeplink,
    useLocaleTourDeeplink,
    usePeraWebImportDeeplink,
    useRecoverAddressDeeplink,
    useSendFundsDeeplink,
    useWalletConnectDeeplink,
} from '../handlers'
import { useDeeplinkErrorHandler } from '../handlers/useDeeplinkErrorHandler'

type HandleDeepLink = (
    url: string,
    replaceCurrentScreen: boolean | undefined,
    source: LinkSource,
    onError?: () => void,
    onSuccess?: () => void,
    onConnectionError?: () => void,
) => Promise<void>

type UseDeepLinkResult = {
    isValidDeepLink: (url: string) => boolean
    /** False when the link parses to a type whose capability is off. */
    isDeepLinkAvailable: (url: string) => boolean
    handleDeepLink: HandleDeepLink
    parseDeeplink: typeof parseDeeplink
    buildDeeplink: (input: BuildDeeplinkInput) => string
}

// Handlers act on the legacy chain until routing resolves each link's own chain.
const ROUTABLE_LINK_CHAINS: ReadonlySet<ChainId> = new Set([LEGACY_CHAIN_ID])

// A chain the app can't route yet claimed the link, so it is refused with a
// toast rather than ignored as "not a link". A routable chain's own refusals
// keep their old outcome.
const isUnsupportedChainLink = (url: string): boolean => {
    const resolution = resolveChainDeeplink(url)
    return (
        resolution.status === 'failed' &&
        resolution.reason !== 'malformed' &&
        !ROUTABLE_LINK_CHAINS.has(resolution.chainId)
    )
}

const isRoutableLink = (link: AppDeeplink): boolean => {
    if (isDevLocaleTourDeeplink(link)) {
        return true
    }
    const target = linkTargetOf(link)
    return !target || ROUTABLE_LINK_CHAINS.has(target.chainId)
}

// Hoisted for a stable identity: `useDeeplinkListener`'s effects depend on it,
// and a per-render arrow re-registers the `Linking` subscription every render.
const isValidDeepLink = (url: string): boolean =>
    parseDeeplink(url) !== null || isUnsupportedChainLink(url)

export const useDeepLink = (): UseDeepLinkResult => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { errorToast, infoToast } = useToast()
    const { setSelectedAccountId } = useSelectedAccountId()
    // A link naming an address outside the wallet leaves the selection alone.
    const findLinkedAccount = (address: string) =>
        findAccountByAddressOn(
            useAccountsStore.getState().accounts,
            LEGACY_CHAIN_ID,
            address,
        )
    const selectAccountByAddress = (address: string) => {
        const account = findLinkedAccount(address)
        if (account) setSelectedAccountId(account.id)
    }
    const swapChainOf = useSwapChainResolver()
    // Fund's provider redirects back with the address it delivered to, on
    // whichever chain the purchase was for.
    const selectAccountByAnyChainAddress = (address: string) => {
        const account = findAccountByAnyChainAddress(
            useAccountsStore.getState().accounts,
            address,
        )
        if (account) setSelectedAccountId(account.id)
    }
    const { t } = useLanguage()
    const { requestByType } = useBottomSheetStore()
    const { showSignRequest } = usePendingSignaturesSheet()
    const isPeraCardEnabled = useIsPeraCardEnabled()
    const isGiftCardsEnabled = useIsGiftCardsEnabled()
    const isAllowed = useCapabilityCheck()

    // CARDS and SELL gate on flag hooks that already fold in their capability.
    const isTypeAvailable = (type: AppDeeplink['type']): boolean => {
        if (type === DeeplinkType.CARDS) return isPeraCardEnabled
        if (type === DeeplinkType.SELL) return isGiftCardsEnabled
        const requirement = capabilityRequirementForDeeplink(type)
        return !requirement || isAllowed(requirement)
    }

    const recoverAddress = useRecoverAddressDeeplink()
    const openSendFunds = useSendFundsDeeplink()
    const submitKeyreg = useKeyregDeeplink()
    const openBrowser = useBrowserDeeplink()
    const openDiscoverPath = useDiscoverPathDeeplink()
    const handlePeraWebImport = usePeraWebImportDeeplink()
    const optInAsset = useAssetOptInDeeplink()
    const showError = useDeeplinkErrorHandler()
    const runLocaleTourStep = useLocaleTourDeeplink()
    const connectWalletConnect = useWalletConnectDeeplink()
    const nativeAsset = useNativeAsset(scope)

    /**
     * Runs a sheet-opening handler WITHOUT awaiting it. Sheets render at the app
     * root and the QR scanner is a native `<Modal>` above it that only the trailing
     * `onSuccess?.()` dismisses, so awaiting pins the camera over UI the user cannot
     * reach. WalletConnect is the one exception: the scanner observes its outcome to re-arm.
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

    const handleDeepLinkImpl: HandleDeepLink = async (
        url: string,
        replaceCurrentScreen: boolean = false,
        source: LinkSource,
        onError?: () => void,
        onSuccess?: () => void,
        onConnectionError?: () => void,
    ) => {
        let parsedData: ReturnType<typeof parseDeeplink> = null

        const refuseUnavailable = (type: string) => {
            logger.warn('Blocked deeplink for an unavailable capability', {
                type,
            })
            // A notification refusal stays silent, like the policy below.
            if (source !== 'notification') {
                errorToast(
                    t('common.network_unavailable.title'),
                    t('common.network_unavailable.generic_body'),
                )
            }
            onError?.()
        }

        try {
            parsedData = parseDeeplink(url)

            if (!parsedData) {
                if (isUnsupportedChainLink(url)) {
                    refuseUnavailable('UNSUPPORTED_CHAIN_LINK')
                    return
                }
                // A recognized-but-unsupported Pera deeplink stays silent, like the QR
                // scanner re-arming on unknown codes; only input not aimed at Pera at
                // all surfaces the invalid-URL toast.
                if (!isPeraOwnedDeeplink(url)) {
                    errorToast(
                        t('errors.deeplink.invalid_url_title'),
                        t('errors.deeplink.invalid_url_body'),
                    )
                }
                onError?.()
                return
            }

            if (
                source === 'notification' &&
                !isNotificationAllowedDeeplinkType(parsedData.type)
            ) {
                logger.warn('Blocked notification deeplink', {
                    type: parsedData.type,
                })
                onError?.()
                return
            }

            if (!isRoutableLink(parsedData)) {
                refuseUnavailable(parsedData.type)
                return
            }

            if (!isTypeAvailable(parsedData.type)) {
                refuseUnavailable(parsedData.type)
                return
            }

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

                case DeeplinkType.TRANSFER: {
                    openSendFunds({
                        assetId:
                            parsedData.assetRef?.assetId ?? nativeAsset.assetId,
                        destination: parsedData.receiverAddress,
                        // Base units — InputScreen converts once the asset's
                        // `decimals` resolve.
                        amountBaseUnits: parsedData.amount,
                        note: parsedData.note ?? parsedData.chainData?.xnote,
                    })
                    break
                }

                case DeeplinkType.CHAIN_ACTION: {
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
                    // The handler surfaces its own errors; a false return
                    // means one of the failure callbacks already fired.
                    const paired = await connectWalletConnect({
                        data: parsedData,
                        source,
                        onError,
                        onConnectionError,
                    })
                    if (!paired) {
                        return
                    }
                    break
                }

                case DeeplinkType.ASSET_OPT_IN: {
                    // A bare `assetId` link carries no account, so the handler prompts
                    // for one. It owns its own confirm, execution and toasts, so nothing
                    // needs observing; detached because it awaits its own sheets.
                    dispatchDetached(
                        optInAsset({
                            assetId: parsedData.assetRef.assetId,
                            address: parsedData.address,
                        }),
                        parsedData.type,
                    )
                    break
                }

                case DeeplinkType.ASSET_DETAIL:
                case DeeplinkType.ASSET_TRANSACTIONS: {
                    selectAccountByAddress(parsedData.address)
                    navigateToScreen(replaceCurrentScreen, 'TabBar', {
                        screen: 'Home',
                        params: {
                            screen: 'AssetDetails',
                            params: {
                                assetId:
                                    parsedData.assetRef?.assetId ??
                                    nativeAsset.assetId,
                                chainId: parsedData.target.chainId,
                            },
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
                    // The swap runs on the account's chain, so the wallet-wide
                    // check above isn't enough: the target account must have one.
                    const target =
                        (parsedData.address &&
                            findLinkedAccount(parsedData.address)) ||
                        useAccountsStore.getState().getSelectedAccount()
                    if (!target || swapChainOf(target) === undefined) {
                        refuseUnavailable(parsedData.type)
                        return
                    }
                    setSelectedAccountId(target.id)
                    navigateToScreen(replaceCurrentScreen, 'TabBar', {
                        screen: 'Swap',
                        params: {
                            assetInId: parsedData.assetInRef?.assetId,
                            assetOutId: parsedData.assetOutRef?.assetId,
                        },
                    })
                    break
                }

                case DeeplinkType.BUY: {
                    if (parsedData.address) {
                        selectAccountByAnyChainAddress(parsedData.address)
                    }
                    navigateToScreen(replaceCurrentScreen, 'TabBar', {
                        screen: 'Fund',
                    })
                    break
                }

                case DeeplinkType.SELL: {
                    // The same Bidali sheet and gate as the Menu's "Buy Gift Card"
                    // button, inheriting its bidaliProvider JS bridge wiring.
                    if (parsedData.address) {
                        selectAccountByAddress(parsedData.address)
                    }
                    void requestByType('bidali', {}, BIDALI_SHEET_OPTIONS)
                    break
                }

                case DeeplinkType.ACCOUNT_DETAIL: {
                    selectAccountByAddress(parsedData.address)
                    navigateToScreen(replaceCurrentScreen, 'TabBar', {
                        screen: 'Home',
                        params: { screen: 'AccountDetails' },
                    })
                    break
                }

                case DeeplinkType.SHARED_ACCOUNT_IMPORT: {
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
                        // A FIDO request derives its P256 key from the HD root, so
                        // without an HD account register has nothing to derive from and
                        // assert nothing to sign with. Explain rather than dead-end in the OS flow.
                        const hasHDWallet = useAccountsStore
                            .getState()
                            .accounts.some(
                                account => hdIndexOf(account) !== undefined,
                            )
                        if (!hasHDWallet) {
                            void requestByType('passkey-hd-wallet-required', {})
                            // Close the QR scanner (when present) so the sheet,
                            // rendered at the root, becomes visible.
                            onError?.()
                            return
                        }

                        // The credential provider is configured `strongOrCredential`, so
                        // any enrolled lock works; only a device with no screen lock
                        // dead-ends (register saves an unprotected key, assert can't prompt).
                        const securityLevel = await getBiometricSecurityLevel()
                        if (!hasStrongBiometricOrCredential(securityLevel)) {
                            void requestByType('passkey-biometric-required', {})
                            // Close the QR scanner (when present) so the sheet,
                            // rendered at the root, becomes visible.
                            onError?.()
                            return
                        }

                        // Hand the fido:// URL back to the OS: iOS routes it to the
                        // AutoFill Credential Provider extension, Android to the Credential Manager.
                        try {
                            // oxlint-disable-next-line pera/no-unvalidated-open-url -- parsed fido: deeplink, native only
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
                        // TODO(liquid-auth): wire the comms-protocol handler here.
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
                    navigateHome(replaceCurrentScreen)
                    break
                }
            }

            onSuccess?.()
        } catch (error) {
            // Never log the raw `url`: a PERA_WEB_IMPORT payload carries the secretbox
            // `encryptionKey` and a RECOVER_ADDRESS payload a mnemonic. Log only the
            // parsed type; `showError` has no field that could carry the url either.
            logger.error(error as Error, { type: parsedData?.type })
            showError({
                variant: 'generic',
                parsedType: parsedData?.type,
                error,
            })
            onError?.()
        }
    }

    // Latest-ref: the impl closes over this render's hook values, the
    // returned wrapper stays identity-stable so listener effects don't
    // resubscribe on every render.
    const handleDeepLinkRef = useRef(handleDeepLinkImpl)
    handleDeepLinkRef.current = handleDeepLinkImpl
    const handleDeepLink = useCallback<HandleDeepLink>(
        (...args) => handleDeepLinkRef.current(...args),
        [],
    )

    // For callers with their own refusal UI (or none), so the dispatcher's toast never doubles it.
    const isTypeAvailableRef = useRef(isTypeAvailable)
    isTypeAvailableRef.current = isTypeAvailable
    const isDeepLinkAvailable = useCallback((url: string): boolean => {
        const parsed = parseDeeplink(url)
        if (!parsed) return !isUnsupportedChainLink(url)
        return isRoutableLink(parsed) && isTypeAvailableRef.current(parsed.type)
    }, [])

    return {
        isValidDeepLink,
        isDeepLinkAvailable,
        handleDeepLink,
        parseDeeplink,
        buildDeeplink,
    }
}
