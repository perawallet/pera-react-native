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

import { PWInfoView, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useBiometricsDisabledPrompt } from '@modules/prompts/hooks/useBiometricsDisabledPrompt'
import { useStyles } from './styles'

export const BIOMETRICS_DISABLED_PROMPT_ID = 'biometrics-disabled-prompt'

/**
 * Shown after the app — not the user — turned biometric unlock off, so the
 * reason the prompt stopped appearing is stated rather than left to be
 * discovered at the lock screen.
 *
 * Neither `onHide` nor `onDismiss` is used: the recorded reason is the whole
 * lifetime. Clearing it drops this from the queue, and keeping it is what lets
 * a failed enable stay on screen with the toast over it. `onDismiss` would also
 * persist a preference keyed by prompt id (suppressing this forever) and
 * `onHide` marks the id dismissed for the session, which would swallow a second
 * drop before the next relaunch.
 */
export const BiometricsDisabledPrompt = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { reason, enable, acknowledge } = useBiometricsDisabledPrompt()

    if (!reason) return null

    const handleEnable = () => {
        void enable()
    }

    return (
        <PWView
            style={styles.container}
            testID='biometrics_disabled_prompt'
        >
            <PWInfoView
                title={t('security.biometrics_disabled.title')}
                body={t(`security.biometrics_disabled.body_${reason}`)}
                primaryAction={{
                    label: t('security.biometrics_disabled.confirm'),
                    onPress: handleEnable,
                    testID: 'biometrics_disabled_prompt_enable_button',
                }}
                secondaryAction={{
                    label: t('security.biometrics_disabled.cancel'),
                    onPress: acknowledge,
                    testID: 'biometrics_disabled_prompt_dismiss_button',
                }}
            />
        </PWView>
    )
}
