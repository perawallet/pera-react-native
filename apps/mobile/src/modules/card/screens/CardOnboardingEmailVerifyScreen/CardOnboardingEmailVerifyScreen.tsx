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

import { PWScreen, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

// Placeholder destination for the email step's "send code" success. The real
// OTP "Confirm your Email" screen lands in the next PR.
export const CardOnboardingEmailVerifyScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWScreen testID='card-onboarding-email-verify'>
            <PWView style={styles.content}>
                <PWText variant='body'>
                    {t('peraCard.intro.coming_soon_body')}
                </PWText>
            </PWView>
        </PWScreen>
    )
}
