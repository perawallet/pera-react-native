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

import { PWButton, PWIcon, PWScreen, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useExpressSendScreen } from './useExpressSendScreen'

const STEPS = [
    'send_funds.express_send.step_1',
    'send_funds.express_send.step_2',
    'send_funds.express_send.step_3',
] as const

export const ExpressSendScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { handleContinue, handleDontShowAgain } = useExpressSendScreen()

    return (
        <PWScreen
            footer={
                <PWView style={styles.footer}>
                    <PWButton
                        title={t('send_funds.express_send.continue')}
                        variant='primary'
                        onPress={handleContinue}
                        testID='express_continue_button'
                    />
                    <PWButton
                        title={t('send_funds.express_send.dont_show_again')}
                        variant='secondary'
                        onPress={handleDontShowAgain}
                        testID='express_dont_show_button'
                    />
                </PWView>
            }
        >
            <PWView style={styles.content}>
                <PWView style={styles.iconRow}>
                    <PWIcon
                        name='wallet'
                        size='xl'
                    />
                    <PWIcon
                        name='swap'
                        size='md'
                        variant='helper'
                    />
                    <PWIcon
                        name='wallet'
                        size='xl'
                    />
                </PWView>

                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {t('send_funds.express_send.title')}
                </PWText>

                <PWText style={styles.body}>
                    {t('send_funds.express_send.body_1')}
                </PWText>

                <PWText style={styles.body}>
                    {t('send_funds.express_send.body_2')}
                </PWText>

                <PWText
                    variant='h4'
                    style={styles.sectionTitle}
                >
                    {t('send_funds.express_send.how_it_works')}
                </PWText>

                {STEPS.map((stepKey, index) => (
                    <PWView
                        key={stepKey}
                        style={styles.stepRow}
                    >
                        <PWText
                            style={styles.stepNumber}
                        >{`${index + 1}.`}</PWText>
                        <PWText style={styles.stepText}>{t(stepKey)}</PWText>
                    </PWView>
                ))}
            </PWView>
        </PWScreen>
    )
}
