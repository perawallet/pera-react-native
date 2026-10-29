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

import React from 'react'
import { PWImage, PWScreen, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { PasskeyUnlockSetupContent } from '../../components/PasskeyUnlockSetup/PasskeyUnlockSetupContent'
import { usePasskeyUnlockSetupScreen } from './usePasskeyUnlockSetupScreen.web'
import { useStyles } from './styles'

import welcomeBackground from '@assets/images/welcome-background.webp'

type PasskeyUnlockSetupScreenProps = {
    onDone: () => void
}

export const PasskeyUnlockSetupScreen = ({
    onDone,
}: PasskeyUnlockSetupScreenProps): React.JSX.Element => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { status, handleEnable, handleNotNow, handleContinue } =
        usePasskeyUnlockSetupScreen({ onDone })

    return (
        <>
            <PWView style={styles.imageContainer}>
                <PWImage
                    source={welcomeBackground}
                    style={styles.headerImage}
                />
            </PWView>
            <PWScreen
                scroll='auto'
                testID='passkey-unlock-setup-screen'
            >
                <PWView style={styles.container}>
                    <PasskeyUnlockSetupContent
                        title={t('vault.passkey_setup.title')}
                        status={status}
                        doneLabel={t('vault.passkey_setup.continue_button')}
                        onEnable={() => void handleEnable()}
                        onSkip={() => void handleNotNow()}
                        onDone={() => void handleContinue()}
                    />
                </PWView>
            </PWScreen>
        </>
    )
}
