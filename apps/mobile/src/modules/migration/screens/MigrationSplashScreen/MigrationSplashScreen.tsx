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
import { ActivityIndicator } from 'react-native'
import { PWButton, PWImage, PWText, PWView } from '@components/core'
import bootsplashLogo from '@assets/bootsplash/logo.png'
import { SPINNER_COLOR, useStyles } from './styles'
import { useMigrationSplashScreen } from './useMigrationSplashScreen'

export const MigrationSplashScreen = () => {
    const styles = useStyles()
    const {
        status,
        failedAccountCount,
        handleContinue,
        handleSkipPermanently,
    } = useMigrationSplashScreen()

    const failureMessage =
        failedAccountCount === 1
            ? `Failed to migrate ${failedAccountCount} account`
            : `Failed to migrate ${failedAccountCount} accounts`

    return (
        <PWView style={styles.container}>
            <PWView style={styles.logoLayer}>
                <PWImage
                    source={bootsplashLogo}
                    style={styles.logo}
                    resizeMode='contain'
                />
            </PWView>
            <PWView style={styles.footer}>
                {status === 'running' && (
                    <ActivityIndicator
                        size='large'
                        color={SPINNER_COLOR}
                        testID='migration_splash_indicator'
                    />
                )}
                {status === 'success' && (
                    <PWText
                        variant='body'
                        style={styles.footerMessage}
                        testID='migration_splash_success'
                    >
                        Migration completed successfully
                    </PWText>
                )}
                {status === 'failure' && (
                    <>
                        <PWText
                            variant='body'
                            style={styles.footerMessage}
                            testID='migration_splash_failure'
                        >
                            {failureMessage}
                        </PWText>
                        <PWView style={styles.continueButton}>
                            <PWButton
                                variant='primary'
                                title='Continue'
                                onPress={handleContinue}
                                testID='migration_splash_continue'
                            />
                        </PWView>
                        <PWView style={styles.continueButton}>
                            <PWButton
                                variant='secondary'
                                title='Do not show again'
                                onPress={handleSkipPermanently}
                                testID='migration_splash_do_not_show_again'
                            />
                        </PWView>
                    </>
                )}
            </PWView>
        </PWView>
    )
}
