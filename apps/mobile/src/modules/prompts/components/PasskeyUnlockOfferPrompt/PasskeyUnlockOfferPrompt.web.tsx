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
import { PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { UserPreferences } from '@constants/user-preferences'
import {
    PasskeyUnlockSetupContent,
    usePasskeyUnlockSetup,
} from '@modules/vault'
import type { PromptViewProps } from '@modules/prompts/models'
import { useStyles } from './styles'

export const PasskeyUnlockOfferPrompt = ({
    onDismiss,
    onHide,
}: PromptViewProps): React.JSX.Element => {
    const styles = useStyles()
    const { t } = useLanguage()
    const id = UserPreferences._passkeyUnlockOfferPrompt
    const { status, enableWithSession, recordSkip } = usePasskeyUnlockSetup({
        screen: 'prompt',
        // A sheet requested while a prompt is on screen is held until the
        // prompt closes, so the password re-check cannot run here. Hiding keeps
        // the offer for the next open, which starts inside a fresh window.
        onReauthRequired: () => onHide(id),
    })

    return (
        <PWView
            style={styles.container}
            testID='passkey_unlock_offer_prompt'
        >
            <PasskeyUnlockSetupContent
                title={t('vault.passkey_setup.offer_title')}
                titleVariant='h3'
                status={status}
                doneLabel={t('common.done')}
                onEnable={() => void enableWithSession()}
                onSkip={() => {
                    recordSkip()
                    onDismiss(id)
                }}
                onDone={() => onDismiss(id)}
            />
        </PWView>
    )
}
