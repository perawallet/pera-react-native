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

import { PWView } from '@components/core/PWView'
import { PWText } from '@components/core/PWText'
import { usePinSecurityPrompt } from './usePinSecurityPrompt'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import type { PromptViewProps } from '@modules/prompts/models'
import { PWInfoView, PWTouchableOpacity } from '@components/core'
import LockImage from '@assets/icons/lock.svg'

export const PinSecurityPrompt = (props: PromptViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { handleSetPinCode, handleNotNow, handleDontAskAgain } =
        usePinSecurityPrompt(props)

    return (
        <PWView
            style={styles.container}
            testID='pin_security_prompt'
        >
            <PWView style={styles.header}>
                <PWTouchableOpacity
                    onPress={handleDontAskAgain}
                    style={styles.dontAskButton}
                    testID='pin_security_prompt_dont_ask_button'
                >
                    <PWText variant='body'>
                        {t('prompts.security.pin_dont_ask_again')}
                    </PWText>
                </PWTouchableOpacity>
            </PWView>

            <PWInfoView
                illustration={LockImage}
                title={t('prompts.security.pin_title')}
                body={t('prompts.security.pin_description')}
                primaryAction={{
                    label: t('prompts.security.pin_setpin'),
                    onPress: handleSetPinCode,
                    testID: 'pin_security_prompt_set_pin_button',
                }}
                secondaryAction={{
                    label: t('prompts.security.pin_notnow'),
                    onPress: handleNotNow,
                    testID: 'pin_security_prompt_not_now_button',
                }}
            />
        </PWView>
    )
}
