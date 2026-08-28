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

import React, { useCallback, useMemo } from 'react'
import { Platform } from 'react-native'
import {
    resolveImportAccountType,
    setPendingImportMnemonic,
} from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import { trackEvent, OnboardingEvent } from '@analytics'
import { type IconName } from '@components/core'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useIsQuantumAccountsEnabled } from '@hooks/useIsQuantumAccountsEnabled'
import { useModalState } from '@hooks/useModalState'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { useDeepLink } from '@hooks/useDeepLink'
import { DeeplinkType } from '@hooks/deeplink/types'
import { type AccountOption } from '@modules/onboarding/types'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    ImportOptionsContent,
    type ImportOptionsContentResult,
} from '../../components/ImportOptionsContent'

export type UseImportAccountOptionsScreenResult = {
    options: AccountOption[]
    isQRScannerVisible: boolean
    handleCloseQRScanner: () => void
    handleQRScannerSuccess: (url: string, restartScanning?: () => void) => void
}

export const useImportAccountOptionsScreen =
    (): UseImportAccountOptionsScreenResult => {
        const navigation = useAppNavigation()
        const { errorToast } = useToast()
        const { t } = useLanguage()
        const { parseDeeplink } = useDeepLink()
        const { request: requestBottomSheet } = useBottomSheet()
        const isQuantumAccountsEnabled = useIsQuantumAccountsEnabled()
        const { network } = useNetwork()

        const {
            isOpen: isQRScannerVisible,
            open: openQRScanner,
            close: closeQRScanner,
        } = useModalState()

        const handleOpenImportOptions = useCallback(async () => {
            const result = await requestBottomSheet<ImportOptionsContentResult>(
                {
                    contents: <ImportOptionsContent />,
                    options: {
                        size: 'auto',
                        enablePanDownToClose: true,
                        autoCreateContainer: false,
                    },
                },
            )
            if (!result) return
            trackEvent(
                result === 'algo25'
                    ? OnboardingEvent.RecoverAlgo25
                    : OnboardingEvent.RecoverOneKey,
            )
            navigation.push('ImportInfo', { accountType: result })
        }, [requestBottomSheet, navigation])

        const handlePairLedgerBle = useCallback(
            () => navigation.push('LedgerPair'),
            [navigation],
        )

        const handlePairLedgerUsb = useCallback(
            () =>
                navigation.push('LedgerInstructions', { transportType: 'usb' }),
            [navigation],
        )

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

                const resolved = resolveImportAccountType(
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
                    accountType: resolved.accountType,
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

        const handleImportQuantum = useCallback(() => {
            navigation.push('ImportAccount', { accountType: 'quantum' })
        }, [navigation])

        const options: AccountOption[] = useMemo(() => {
            const allOptions: AccountOption[] = [
                {
                    testID: 'import_account_options_recover_wallet_button',
                    titleKey:
                        'onboarding.import_account_options.recover_wallet_title',
                    descriptionKey:
                        'onboarding.import_account_options.recover_wallet_description',
                    leftIcon: 'fund' as IconName,
                    onPress: () => void handleOpenImportOptions(),
                },
                ...(isQuantumAccountsEnabled
                    ? [
                          {
                              testID: 'import_account_quantum_button',
                              titleKey:
                                  'onboarding.import_account_options.quantum_title',
                              descriptionKey:
                                  'onboarding.import_account_options.quantum_description',
                              leftIcon: 'quantum' as IconName,
                              onPress: handleImportQuantum,
                          },
                      ]
                    : []),
                {
                    testID: 'import_account_options_recover_qr_button',
                    titleKey:
                        'onboarding.import_account_options.recover_qr_title',
                    descriptionKey:
                        'onboarding.import_account_options.recover_qr_description',
                    leftIcon: 'qr' as IconName,
                    onPress: openQRScanner,
                },
                {
                    testID: 'import_account_options_pair_ledger_button',
                    titleKey:
                        'onboarding.import_account_options.pair_ledger_title',
                    descriptionKey:
                        'onboarding.import_account_options.pair_ledger_description',
                    leftIcon: 'wallet' as IconName,
                    onPress: handlePairLedgerBle,
                },
            ]

            if (Platform.OS === 'android' || Platform.OS === 'web') {
                allOptions.push({
                    testID: 'import_account_options_pair_ledger_usb_button',
                    titleKey:
                        'onboarding.import_account_options.pair_ledger_usb_title',
                    descriptionKey:
                        'onboarding.import_account_options.pair_ledger_usb_description',
                    leftIcon: 'wallet' as IconName,
                    onPress: handlePairLedgerUsb,
                })
            }

            // There is no Pera-free source for a Pera Web backup, so the
            // flow can't work on betanet/custom — disable the row instead
            // of letting the user hit a misleading fetch failure.
            const isPeraWebImportAvailable = isPeraBackedNetwork(network)

            allOptions.push(
                {
                    testID: 'import_account_options_pera_web_button',
                    titleKey:
                        'onboarding.import_account_options.pera_web_title',
                    descriptionKey: isPeraWebImportAvailable
                        ? 'onboarding.import_account_options.pera_web_description'
                        : 'common.network_unavailable.body',
                    leftIcon: 'globe' as IconName,
                    onPress: handleImportPeraWeb,
                    isDisabled: !isPeraWebImportAvailable,
                },
                {
                    testID: 'import_account_options_asb_button',
                    titleKey: 'onboarding.import_account_options.asb_title',
                    descriptionKey:
                        'onboarding.import_account_options.asb_description',
                    leftIcon: 'shield-check' as IconName,
                    onPress: handleImportAsb,
                },
            )

            return allOptions
        }, [
            handleOpenImportOptions,
            openQRScanner,
            handlePairLedgerBle,
            handlePairLedgerUsb,
            handleImportAsb,
            handleImportPeraWeb,
            handleImportQuantum,
            isQuantumAccountsEnabled,
            network,
        ])

        return {
            options,
            isQRScannerVisible,
            handleCloseQRScanner: closeQRScanner,
            handleQRScannerSuccess,
        }
    }
