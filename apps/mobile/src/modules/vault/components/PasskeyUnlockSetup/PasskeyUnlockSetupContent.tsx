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
import { PWButton, PWResultView, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { PasskeySetupFailure } from './PasskeySetupFailure'
import {
    isPasskeySetupFailure,
    type PasskeyUnlockSetupStatus,
} from './usePasskeyUnlockSetup.web'
import { useStyles } from './styles'

type PasskeyUnlockSetupContentProps = {
    title: string
    titleVariant?: 'h2' | 'h3'
    status: PasskeyUnlockSetupStatus
    /** Label of the single button on the success view. */
    doneLabel: string
    onEnable: () => void
    onSkip: () => void
    onDone: () => void
    testID?: string
}

// Failure, pending and success add to or replace the body inside one frame,
// so nothing jumps while the browser's passkey prompts come and go.
export const PasskeyUnlockSetupContent = ({
    title,
    titleVariant = 'h2',
    status,
    doneLabel,
    onEnable,
    onSkip,
    onDone,
    testID = 'passkey-unlock-setup',
}: PasskeyUnlockSetupContentProps): React.JSX.Element => {
    const styles = useStyles()
    const { t } = useLanguage()

    if (status === 'enabled') {
        return (
            <PWResultView
                variant='success'
                icon='shield-check'
                title={t('vault.passkey_setup.success_title')}
                body={t('vault.passkey_setup.success_body')}
                primaryAction={{ label: doneLabel, onPress: onDone }}
                testID={`${testID}-success`}
            />
        )
    }

    const isFailure = isPasskeySetupFailure(status)
    const isPending = status === 'pending'

    return (
        <PWView style={styles.container}>
            <PWText
                variant={titleVariant}
                weight={600}
                style={styles.title}
            >
                {title}
            </PWText>
            <PWText
                variant='body'
                style={styles.body}
            >
                {t('vault.passkey_setup.body')}
            </PWText>
            {isFailure && (
                <PasskeySetupFailure
                    status={status}
                    testID={testID}
                />
            )}
            <PWView style={styles.actions}>
                <PWButton
                    variant='primary'
                    title={t(
                        isFailure
                            ? 'vault.passkey_setup.retry_button'
                            : 'vault.passkey_setup.enable_button',
                    )}
                    isLoading={isPending}
                    onPress={onEnable}
                    testID={`${testID}-enable`}
                />
                <PWButton
                    variant='link'
                    title={t('vault.passkey_setup.not_now_button')}
                    isDisabled={isPending}
                    onPress={onSkip}
                    testID={`${testID}-skip`}
                />
            </PWView>
            {isPending && (
                <PWText
                    variant='caption'
                    style={styles.hint}
                    testID={`${testID}-pending-hint`}
                >
                    {t('vault.passkey_setup.pending_hint')}
                </PWText>
            )}
        </PWView>
    )
}
