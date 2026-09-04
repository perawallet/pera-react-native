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
import { useTranslation } from 'react-i18next'
import { PWButton, PWListItem, PWText, PWView } from '@components/core'
import {
    useAutofillPickerScreen,
    type AutofillPickerCaller,
} from './useAutofillPickerScreen'
import { useStyles } from './styles'

type AutofillPickerScreenProps = {
    caller: AutofillPickerCaller
}

export const AutofillPickerScreen = ({ caller }: AutofillPickerScreenProps) => {
    const { t } = useTranslation()
    const {
        callerText,
        hostText,
        isUnlocked,
        isUnlocking,
        logins,
        handleUnlock,
        handleSelect,
        handleCancel,
    } = useAutofillPickerScreen(caller)
    const styles = useStyles()

    return (
        <PWView style={styles.container}>
            <PWText variant='h4'>
                {t('settings.passwords.autofill_picker_title')}
            </PWText>

            {/* callerText is rendered verbatim: the hook sanitises the label and
                puts the package first, and re-deriving it here would undo that
                without any test noticing. */}
            <PWText
                variant='caption'
                style={styles.caller}
            >
                {t('settings.passwords.autofill_picker_caller', {
                    caller: callerText,
                })}
            </PWText>

            {hostText !== null && (
                <PWText
                    variant='caption'
                    style={styles.host}
                >
                    {t('settings.passwords.autofill_picker_host', {
                        host: hostText,
                    })}
                </PWText>
            )}

            {isUnlocked ? (
                logins.length === 0 ? (
                    <PWText
                        variant='caption'
                        style={styles.empty}
                    >
                        {t('settings.passwords.autofill_picker_empty')}
                    </PWText>
                ) : (
                    logins.map(login => (
                        <PWListItem
                            key={login.id}
                            icon='key'
                            title={login.username}
                            value={login.domain}
                            onPress={() => handleSelect(login.id)}
                        />
                    ))
                )
            ) : (
                <PWButton
                    variant='primary'
                    title={t(
                        'settings.passwords.autofill_picker_unlock_action',
                    )}
                    onPress={handleUnlock}
                    isLoading={isUnlocking}
                    style={styles.unlock}
                />
            )}

            <PWButton
                variant='secondary'
                title={t('settings.passwords.autofill_picker_cancel')}
                onPress={handleCancel}
                style={styles.cancel}
            />
        </PWView>
    )
}
