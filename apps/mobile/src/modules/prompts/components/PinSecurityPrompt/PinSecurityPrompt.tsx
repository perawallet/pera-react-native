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

import { PWView } from '@components/core/PWView'
import { PWText } from '@components/core/PWText'
import { PWButton } from '@components/core/PWButton'
import { usePinSecurityPrompt } from './usePinSecurityPrompt'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { PromptViewProps } from '@modules/prompts/models'
import { PWImage, PWTouchableOpacity } from '@components/core'
import lockImage from '@assets/images/lock.webp'

export const PinSecurityPrompt = (props: PromptViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { handleSetPinCode, handleNotNow, handleDontAskAgain } =
        usePinSecurityPrompt(props)

    return (
        <PWView style={styles.container}>
            <PWView style={styles.header}>
                <PWTouchableOpacity
                    onPress={handleDontAskAgain}
                    style={styles.dontAskButton}
                >
                    <PWText variant='body'>
                        {t('prompts.security.pin_dont_ask_again')}
                    </PWText>
                </PWTouchableOpacity>
            </PWView>

            <PWImage
                source={lockImage}
                width={150}
                height={175}
            />

            <PWView style={styles.content}>
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('prompts.security.pin_title')}
                </PWText>

                <PWText
                    variant='body'
                    style={styles.description}
                >
                    {t('prompts.security.pin_description')}
                </PWText>
            </PWView>

            <PWView style={styles.buttonContainer}>
                <PWButton
                    onPress={handleSetPinCode}
                    variant='primary'
                    title={t('prompts.security.pin_setpin')}
                />

                <PWButton
                    onPress={handleNotNow}
                    variant='secondary'
                    title={t('prompts.security.pin_notnow')}
                />
            </PWView>
        </PWView>
    )
}
