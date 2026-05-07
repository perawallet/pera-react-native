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

import { useCallback, useMemo } from 'react'
import { Platform } from 'react-native'
import {
    resolveImportAccountType,
    useImportAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useMarkMnemonicBackupComplete } from '@perawallet/wallet-core-backup'
import { logger } from '@perawallet/wallet-core-shared'
import { type IconName } from '@components/core'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useModalState } from '@hooks/useModalState'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { useDeepLink } from '@hooks/useDeepLink'
import { DeeplinkType } from '@hooks/deeplink/types'
import { type AccountOption } from '@modules/onboarding/types'

export type UseImportAccountOptionsScreenResult = {
    options: AccountOption[]
    isImportOptionsVisible: boolean
    handleCloseImportOptions: () => void
    handleHDWalletPress: () => void
    handleAlgo25Press: () => void
    isQRScannerVisible: boolean
    handleCloseQRScanner: () => void
    handleQRScannerSuccess: (
        url: string,
        restartScanning?: () => void,
    ) => Promise<void>
    isImporting: boolean
}

export const useImportAccountOptionsScreen =
    (): UseImportAccountOptionsScreenResult => {
        const navigation = useAppNavigation()
        const { showToast } = useToast()
        const { t } = useLanguage()
        const { parseDeeplink } = useDeepLink()
        const importAccount = useImportAccount()
        const markBackupComplete = useMarkMnemonicBackupComplete()

        const {
            isOpen: isImportOptionsVisible,
            open: openImportOptions,
            close: closeImportOptions,
        } = useModalState()

        const {
            isOpen: isQRScannerVisible,
            open: openQRScanner,
            close: closeQRScanner,
        } = useModalState()

        const {
            isOpen: isImporting,
            open: openImporting,
            close: closeImporting,
        } = useModalState()

        const handleHDWalletPress = useCallback(() => {
            closeImportOptions()
            navigation.push('ImportInfo', { accountType: 'hdWallet' })
        }, [closeImportOptions, navigation])

        const handleAlgo25Press = useCallback(() => {
            closeImportOptions()
            navigation.push('ImportInfo', { accountType: 'algo25' })
        }, [closeImportOptions, navigation])

        const handlePairLedgerBle = useCallback(
            () =>
                navigation.push('LedgerInstructions', { transportType: 'ble' }),
            [navigation],
        )

        const handlePairLedgerUsb = useCallback(
            () =>
                navigation.push('LedgerInstructions', { transportType: 'usb' }),
            [navigation],
        )

        const handleQRScannerSuccess = useCallback(
            async (url: string, restartScanning?: () => void) => {
                closeQRScanner()

                const parsedDeeplink = parseDeeplink(url)

                if (parsedDeeplink?.type !== DeeplinkType.RECOVER_ADDRESS) {
                    showToast({
                        title: t(
                            'onboarding.add_account.qr_scan_invalid_title',
                        ),
                        body: t('onboarding.add_account.qr_scan_invalid_body'),
                        type: 'error',
                    })
                    restartScanning?.()
                    return
                }

                const resolved = resolveImportAccountType(
                    parsedDeeplink.mnemonic,
                )
                if (!resolved.success) {
                    showToast({
                        title: t(
                            'onboarding.add_account.qr_scan_invalid_mnemonic_title',
                        ),
                        body: t(
                            'onboarding.add_account.qr_scan_invalid_mnemonic_body',
                        ),
                        type: 'error',
                    })
                    restartScanning?.()
                    return
                }

                openImporting()
                try {
                    const result = await importAccount({
                        mnemonic: parsedDeeplink.mnemonic,
                        type: resolved.accountType,
                    })

                    if (result.type === 'hdWallet' && 'walletKeyId' in result) {
                        navigation.push('SearchAccounts', {
                            mode: 'import',
                            walletKeyId: result.walletKeyId,
                            derivationType: result.derivationType,
                        })
                    } else {
                        markBackupComplete(result as WalletAccount)
                        navigation.push('SearchAccounts', {
                            account: result as WalletAccount,
                        })
                    }
                } catch (error) {
                    logger.error('QR import failed', { error })
                    // guardrails-ignore-next-line no-error-toast-in-catch reason: localized import_account.failed_body preserved; raw error not surfaced to user
                    showToast({
                        title: t('onboarding.import_account.failed_title'),
                        body: t('onboarding.import_account.failed_body'),
                        type: 'error',
                    })
                    restartScanning?.()
                } finally {
                    closeImporting()
                }
            },
            [
                closeQRScanner,
                parseDeeplink,
                navigation,
                showToast,
                t,
                importAccount,
                markBackupComplete,
                openImporting,
                closeImporting,
            ],
        )

        const handleNotImplemented = useCallback(() => {
            showToast({
                title: t('common.not_implemented.title'),
                body: t('common.not_implemented.body'),
                type: 'error',
            })
        }, [showToast, t])

        const options: AccountOption[] = useMemo(() => {
            const allOptions: AccountOption[] = [
                {
                    testID: 'import_account_options_recover_wallet_button',
                    titleKey:
                        'onboarding.import_account_options.recover_wallet_title',
                    descriptionKey:
                        'onboarding.import_account_options.recover_wallet_description',
                    leftIcon: 'fund' as IconName,
                    onPress: openImportOptions,
                },
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

            if (Platform.OS === 'android') {
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

            allOptions.push(
                {
                    testID: 'import_account_options_pera_web_button',
                    titleKey:
                        'onboarding.import_account_options.pera_web_title',
                    descriptionKey:
                        'onboarding.import_account_options.pera_web_description',
                    leftIcon: 'globe' as IconName,
                    onPress: handleNotImplemented,
                },
                {
                    testID: 'import_account_options_asb_button',
                    titleKey: 'onboarding.import_account_options.asb_title',
                    descriptionKey:
                        'onboarding.import_account_options.asb_description',
                    leftIcon: 'shield-check' as IconName,
                    onPress: handleNotImplemented,
                },
            )

            return allOptions
        }, [
            openImportOptions,
            openQRScanner,
            handlePairLedgerBle,
            handlePairLedgerUsb,
            handleNotImplemented,
        ])

        return {
            options,
            isImportOptionsVisible,
            handleCloseImportOptions: closeImportOptions,
            handleHDWalletPress,
            handleAlgo25Press,
            isQRScannerVisible,
            handleCloseQRScanner: closeQRScanner,
            handleQRScannerSuccess,
            isImporting,
        }
    }
