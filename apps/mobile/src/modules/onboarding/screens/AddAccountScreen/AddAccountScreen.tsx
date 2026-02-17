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

import React from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    PWIcon,
    PWImage,
    PWLoadingOverlay,
    PWScrollView,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { PanelButton } from '@components/PanelButton'
import { ImportOptionsBottomSheet } from '../OnboardingScreen/ImportOptionsBottomSheet'
import { useAddAccountScreen } from './useAddAccountScreen'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'

import welcomeBackground from '@assets/images/welcome-background.webp'

export const AddAccountScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const insets = useSafeAreaInsets()
    const {
        hasHDWallet,
        isCreatingAccount,
        isImportOptionsVisible,
        handleClose,
        handleAddAccount,
        handleImportAccount,
        handleCloseImportOptions,
        handleHDWalletPress,
        handleAlgo25Press,
        handleWatchAddress,
        handleCreateUniversalWallet,
        handleCreateAlgo25,
    } = useAddAccountScreen()

    return (
        <>
            <PWView style={styles.imageContainer}>
                <PWImage
                    source={welcomeBackground}
                    style={styles.headerImage}
                />
            </PWView>
            <PWView style={[styles.rootContainer, { paddingTop: insets.top }]}>
                <PWToolbar
                    left={
                        <PWIcon
                            name='cross'
                            onPress={handleClose}
                            testID='add_account_close_button'
                        />
                    }
                />

                <PWView style={styles.headerContainer}>
                    <PWText
                        variant='h1'
                        style={styles.headerTitle}
                    >
                        {t('onboarding.add_account.title')}
                    </PWText>
                </PWView>

                <PWScrollView contentContainerStyle={styles.scrollContent}>
                    <PWView style={styles.mainContainer}>
                        {hasHDWallet && (
                            <PanelButton
                                testID='add_account_add_button'
                                title={t(
                                    'onboarding.add_account.add_account_option_title',
                                )}
                                description={t(
                                    'onboarding.add_account.add_account_option_description',
                                )}
                                titleWeight='h4'
                                leftIcon='wallet-with-algo'
                                onPress={handleAddAccount}
                                disabled={isCreatingAccount}
                            />
                        )}

                        <PanelButton
                            testID='add_account_import_button'
                            title={t(
                                'onboarding.add_account.import_account_option_title',
                            )}
                            description={t(
                                'onboarding.add_account.import_account_option_description',
                            )}
                            titleWeight='h4'
                            leftIcon='key'
                            onPress={handleImportAccount}
                        />

                        <PanelButton
                            testID='add_account_watch_button'
                            title={t(
                                'onboarding.add_account.watch_address_option_title',
                            )}
                            description={t(
                                'onboarding.add_account.watch_address_option_description',
                            )}
                            titleWeight='h4'
                            leftIcon='eye'
                            onPress={handleWatchAddress}
                        />

                        <PanelButton
                            testID='add_account_create_universal_wallet_button'
                            title={t(
                                'onboarding.add_account.create_universal_wallet_option_title',
                            )}
                            description={t(
                                'onboarding.add_account.create_universal_wallet_option_description',
                            )}
                            titleWeight='h4'
                            leftIcon='wallet-with-algo'
                            onPress={handleCreateUniversalWallet}
                            disabled={isCreatingAccount}
                        />

                        <PanelButton
                            testID='add_account_create_algo25_button'
                            title={t(
                                'onboarding.add_account.create_algo25_option_title',
                            )}
                            description={t(
                                'onboarding.add_account.create_algo25_option_description',
                            )}
                            titleWeight='h4'
                            leftIcon='wallet'
                            onPress={handleCreateAlgo25}
                            disabled={isCreatingAccount}
                        />
                    </PWView>
                </PWScrollView>
            </PWView>

            <ImportOptionsBottomSheet
                isVisible={isImportOptionsVisible}
                onClose={handleCloseImportOptions}
                onHDWalletPress={handleHDWalletPress}
                onAlgo25Press={handleAlgo25Press}
            />

            <PWLoadingOverlay
                isVisible={isCreatingAccount}
                title={t('onboarding.create_account.processing')}
            />
        </>
    )
}
