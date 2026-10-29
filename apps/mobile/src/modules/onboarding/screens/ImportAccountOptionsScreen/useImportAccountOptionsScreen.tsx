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

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { type RouteProp, useRoute } from '@react-navigation/native'
import {
    detectImportKind,
    keyKindOptionsOf,
    setPendingImportMnemonic,
} from '@perawallet/wallet-core-accounts'
import { useCloudBackupStore } from '@perawallet/wallet-core-backup'
import {
    LEGACY_CHAIN_ID,
    i18nKey,
    type ChainId,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { IconName } from '@components/core'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useIsCloudBackupAvailable } from '@hooks/useIsCloudBackupAvailable'
import { useCapability } from '@hooks/useCapability'
import { useCapableChainIds } from '@hooks/useCapableChainIds'
import { useModalState } from '@hooks/useModalState'
import { useTabHandoff } from '@hooks/useTabHandoff'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import {
    ChainSelectionContent,
    useDeepLink,
    DeeplinkType,
} from '@modules/deeplink'
import type { AccountOption } from '@modules/onboarding/types'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useRestoreBackupOptions } from '@modules/cloud-backup'
import { useSupportedLedgerTransports } from '@modules/ledger'
import {
    ImportOptionsContent,
    type ImportOptionsContentResult,
} from '../../components/ImportOptionsContent'
import {
    LedgerTransportOptionsContent,
    type LedgerTransportOptionsContentResult,
} from '../../components/LedgerTransportOptionsContent'
import { useIsOnboarding } from '../../hooks/useOnboardingStore'
import { usePrivateKeyImportChainId } from '../../hooks/usePrivateKeyImportChainId'
import type { ImportFlowParamList } from '../../routes/types'
import { trackChainOnboardingEvent } from '../../utils'

export type UseImportAccountOptionsScreenResult = {
    titleKey: I18nKey
    mainOptions: AccountOption[]
    otherOptions: AccountOption[]
    isOtherOptionsVisible: boolean
    handleToggleOtherOptions: () => void
    isQRScannerVisible: boolean
    handleCloseQRScanner: () => void
    handleQRScannerSuccess: (url: string, restartScanning?: () => void) => void
    isReadingCredentials: boolean
}

export const useImportAccountOptionsScreen =
    (): UseImportAccountOptionsScreenResult => {
        const navigation = useAppNavigation()
        const { errorToast } = useToast()
        const { t } = useLanguage()
        const { parseDeeplink } = useDeepLink()
        const { request: requestBottomSheet } = useBottomSheet()
        const { chooseRestoreRoute, isReadingCredentials } =
            useRestoreBackupOptions()
        const { isOnboarding } = useIsOnboarding()
        const canUseLedger = useCapability({ anyChain: 'ledger' })
        const ledgerChainIds = useCapableChainIds('ledger')
        const canUseLedgerUsb = useCapability({
            platform: 'ledgerUsb',
            anyChain: 'ledger',
        })
        const canImportPeraWeb = useCapability({ anyChain: 'peraWebImport' })
        const isCloudBackupAvailable = useIsCloudBackupAvailable()
        const canImportSecureBackup = useCapability({
            anyChain: 'secureBackup',
        })
        const {
            isReady: isLedgerSupportKnown,
            supportedTransportTypes: ledgerTransports,
        } = useSupportedLedgerTransports()
        // Browsers differ (Brave ships Web Bluetooth off, Firefox has neither
        // API), so each row reflects what this one can do. Enabled until the
        // check resolves, so rows don't flash disabled on every visit.
        const isLedgerBleAvailable =
            !isLedgerSupportKnown || ledgerTransports.includes('ble')
        const isLedgerUsbAvailable =
            !isLedgerSupportKnown || ledgerTransports.includes('usb')
        const isCloudBackupConfigured = useCloudBackupStore(state =>
            state.isConfigured(),
        )
        const privateKeyChainId = usePrivateKeyImportChainId()
        const [isOtherOptionsVisible, setIsOtherOptionsVisible] =
            useState(false)

        const {
            isOpen: isQRScannerVisible,
            open: openQRScanner,
            close: closeQRScanner,
        } = useModalState()
        const { shouldHandOff, openTab } = useTabHandoff('recover-qr')
        const isScannerOpenOnArrival =
            useRoute<RouteProp<ImportFlowParamList, 'ImportAccountOptions'>>()
                .params?.isScannerOpen ?? false

        useEffect(() => {
            if (isScannerOpenOnArrival) openQRScanner()
        }, [isScannerOpenOnArrival, openQRScanner])

        const handleOpenQRScanner = useCallback(() => {
            if (shouldHandOff) {
                void openTab()
                return
            }
            openQRScanner()
        }, [shouldHandOff, openTab, openQRScanner])

        const handleOpenImportOptions = useCallback(async () => {
            const result = await requestBottomSheet<ImportOptionsContentResult>(
                {
                    contents: (
                        <ImportOptionsContent chainId={LEGACY_CHAIN_ID} />
                    ),
                    options: {
                        size: 'auto',
                        enablePanDownToClose: true,
                        autoCreateContainer: false,
                    },
                },
            )
            if (result === undefined) return
            trackChainOnboardingEvent(
                keyKindOptionsOf(LEGACY_CHAIN_ID, result)?.recover
                    ?.analyticsEvent,
                LEGACY_CHAIN_ID,
            )
            navigation.push('ImportInfo', { accountType: result })
        }, [requestBottomSheet, navigation])

        // Asked here because the add-account flow has no chain step; with a
        // single Ledger chain the flow starts on it without asking.
        const chooseLedgerChain = useCallback(async (): Promise<
            Optional<ChainId>
        > => {
            if (ledgerChainIds.length <= 1) return ledgerChainIds[0]
            return requestBottomSheet<ChainId>({
                contents: (
                    <ChainSelectionContent
                        chainIds={ledgerChainIds}
                        title={t('ledger.select_chain.title')}
                    />
                ),
                options: {
                    size: 'auto',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            })
        }, [ledgerChainIds, requestBottomSheet, t])

        const handlePairLedgerBle = useCallback(async () => {
            const chainId = await chooseLedgerChain()
            if (chainId) navigation.push('LedgerPair', { chainId })
        }, [chooseLedgerChain, navigation])

        const handlePairLedgerUsb = useCallback(async () => {
            const chainId = await chooseLedgerChain()
            if (chainId) {
                navigation.push('LedgerInstructions', {
                    transportType: 'usb',
                    chainId,
                })
            }
        }, [chooseLedgerChain, navigation])

        // Only where USB is possible is there a transport to choose.
        const handlePairLedger = useCallback(async () => {
            if (!canUseLedgerUsb) {
                await handlePairLedgerBle()
                return
            }
            const transport =
                await requestBottomSheet<LedgerTransportOptionsContentResult>({
                    contents: (
                        <LedgerTransportOptionsContent
                            isBleAvailable={isLedgerBleAvailable}
                            isUsbAvailable={isLedgerUsbAvailable}
                        />
                    ),
                    options: {
                        size: 'auto',
                        enablePanDownToClose: true,
                        autoCreateContainer: false,
                    },
                })
            if (transport === 'ble') await handlePairLedgerBle()
            if (transport === 'usb') await handlePairLedgerUsb()
        }, [
            canUseLedgerUsb,
            requestBottomSheet,
            isLedgerBleAvailable,
            isLedgerUsbAvailable,
            handlePairLedgerBle,
            handlePairLedgerUsb,
        ])

        const handleQRScannerSuccess = useCallback(
            (url: string, restartScanning?: () => void) => {
                closeQRScanner()

                const parsedDeeplink = parseDeeplink(url)

                if (parsedDeeplink?.type !== DeeplinkType.RECOVER_ADDRESS) {
                    errorToast(
                        t('onboarding.add_account.qr_scan_invalid_title'),
                        t('onboarding.add_account.qr_scan_invalid_body'),
                    )
                    restartScanning?.()
                    return
                }

                const resolved = detectImportKind(
                    LEGACY_CHAIN_ID,
                    parsedDeeplink.mnemonic,
                )
                if (!resolved.success) {
                    errorToast(
                        t(
                            'onboarding.add_account.qr_scan_invalid_mnemonic_title',
                        ),
                        t(
                            'onboarding.add_account.qr_scan_invalid_mnemonic_body',
                        ),
                    )
                    restartScanning?.()
                    return
                }

                // Don't import straight from the scan: hand the parsed words to
                // the Import screen so the user confirms the passphrase (and
                // later names the account) before importing. The mnemonic is
                // passed via an in-memory store, not a route param, so the
                // secret never enters the navigation state tree.
                setPendingImportMnemonic(parsedDeeplink.mnemonic)
                navigation.push('ImportAccount', {
                    accountType: resolved.seed,
                })
            },
            [closeQRScanner, parseDeeplink, navigation, errorToast, t],
        )

        const handleImportAsb = useCallback(() => {
            navigation.push('AsbImportInfo')
        }, [navigation])

        const handleImportPeraWeb = useCallback(() => {
            navigation.push('PeraWebImportInfo')
        }, [navigation])

        // Restoring over a device that already holds a backup would replace
        // the local backup identity, orphaning what this device pushed.
        const handleImportCloudBackup = useCallback(async () => {
            if (isCloudBackupConfigured) {
                errorToast(
                    t(
                        'onboarding.import_account_options.cloud_backup_already_enabled_title',
                    ),
                    t(
                        'onboarding.import_account_options.cloud_backup_already_enabled_body',
                    ),
                )
                return
            }

            const route = await chooseRestoreRoute()
            if (!route) return
            const [screen, params] = route
            navigation.push(screen, params)
        }, [
            isCloudBackupConfigured,
            errorToast,
            t,
            chooseRestoreRoute,
            navigation,
        ])

        const privateKeyImportOptions: AccountOption[] = useMemo(
            () =>
                privateKeyChainId
                    ? [
                          {
                              testID: 'import_account_options_private_key_button',
                              titleKey: i18nKey(
                                  'onboarding.import_account_options.private_key_title',
                              ),
                              descriptionKey: i18nKey(
                                  'onboarding.import_account_options.private_key_description',
                              ),
                              leftIcon: 'key' as IconName,
                              onPress: () =>
                                  navigation.push('ImportPrivateKey', {
                                      chainId: privateKeyChainId,
                                  }),
                          },
                      ]
                    : [],
            [privateKeyChainId, navigation],
        )

        const isLedgerAvailable = canUseLedgerUsb
            ? isLedgerBleAvailable || isLedgerUsbAvailable
            : isLedgerBleAvailable

        const mainOptions: AccountOption[] = useMemo(
            () =>
                (
                    [
                        {
                            testID: 'import_account_options_recover_wallet_button',
                            titleKey: i18nKey(
                                'onboarding.import_account_options.recover_passphrase_title',
                            ),
                            descriptionKey: i18nKey(
                                'onboarding.import_account_options.recover_passphrase_description',
                            ),
                            leftIcon: 'key' as IconName,
                            onPress: () => {
                                void handleOpenImportOptions()
                            },
                        },
                        isCloudBackupAvailable && {
                            testID: 'import_account_options_cloud_backup_button',
                            titleKey: i18nKey(
                                'onboarding.import_account_options.cloud_backup_title',
                            ),
                            descriptionKey: i18nKey(
                                'onboarding.import_account_options.cloud_backup_description',
                            ),
                            leftIcon: 'cloud-download' as IconName,
                            onPress: () => {
                                void handleImportCloudBackup()
                            },
                        },
                        canUseLedger && {
                            testID: 'import_account_options_pair_ledger_button',
                            titleKey: i18nKey(
                                'onboarding.import_account_options.pair_ledger_title',
                            ),
                            descriptionKey: isLedgerAvailable
                                ? i18nKey(
                                      'onboarding.import_account_options.pair_ledger_description',
                                  )
                                : i18nKey(
                                      'onboarding.import_account_options.pair_ledger_unsupported_description',
                                  ),
                            leftIcon: 'ledger' as IconName,
                            onPress: () => {
                                void handlePairLedger()
                            },
                            isDisabled: !isLedgerAvailable,
                        },
                    ] satisfies (AccountOption | false)[]
                ).filter((option): option is AccountOption => !!option),
            [
                handleOpenImportOptions,
                handleImportCloudBackup,
                handlePairLedger,
                isCloudBackupAvailable,
                canUseLedger,
                isLedgerAvailable,
            ],
        )

        const otherOptions: AccountOption[] = useMemo(
            () =>
                (
                    [
                        canImportPeraWeb && {
                            testID: 'import_account_options_pera_web_button',
                            titleKey: i18nKey(
                                'onboarding.import_account_options.pera_web_title',
                            ),
                            descriptionKey: i18nKey(
                                'onboarding.import_account_options.pera_web_description',
                            ),
                            leftIcon: 'globe' as IconName,
                            onPress: handleImportPeraWeb,
                        },
                        canImportSecureBackup && {
                            testID: 'import_account_options_asb_button',
                            titleKey: isCloudBackupAvailable
                                ? i18nKey(
                                      'onboarding.import_account_options.asb_legacy_title',
                                  )
                                : i18nKey(
                                      'onboarding.import_account_options.asb_title',
                                  ),
                            descriptionKey: i18nKey(
                                'onboarding.import_account_options.asb_description',
                            ),
                            leftIcon: 'shield-check' as IconName,
                            onPress: handleImportAsb,
                        },
                        {
                            testID: 'import_account_options_recover_qr_button',
                            titleKey: i18nKey(
                                'onboarding.import_account_options.recover_qr_title',
                            ),
                            descriptionKey: i18nKey(
                                'onboarding.import_account_options.recover_qr_description',
                            ),
                            leftIcon: 'qr' as IconName,
                            onPress: handleOpenQRScanner,
                        },
                        ...privateKeyImportOptions,
                    ] satisfies (AccountOption | false)[]
                ).filter((option): option is AccountOption => !!option),
            [
                canImportPeraWeb,
                canImportSecureBackup,
                isCloudBackupAvailable,
                handleImportPeraWeb,
                handleImportAsb,
                handleOpenQRScanner,
                privateKeyImportOptions,
            ],
        )

        const handleToggleOtherOptions = useCallback(
            () => setIsOtherOptionsVisible(prev => !prev),
            [],
        )

        return {
            titleKey: isOnboarding
                ? i18nKey('onboarding.import_account_options.onboarding_title')
                : i18nKey('onboarding.import_account_options.title'),
            mainOptions,
            otherOptions,
            isOtherOptionsVisible,
            handleToggleOtherOptions,
            isQRScannerVisible,
            handleCloseQRScanner: closeQRScanner,
            handleQRScannerSuccess,
            isReadingCredentials,
        }
    }
