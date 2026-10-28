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
import { PWText, PWView } from '@components/core'
import { InfoCallout } from '@components/InfoCallout'
import { useLanguage } from '@hooks/useLanguage'
import type { PasskeyUnlockSetupFailure } from './usePasskeyUnlockSetup.web'
import { useStyles } from './styles'

// Literal keys, so the unused-translation-key lint can see every one.
const COPY: Record<
    PasskeyUnlockSetupFailure,
    { error: string; hint: { title: string; body: string } | null }
> = {
    'not-saved': {
        error: 'vault.passkey_setup.error_not_saved',
        hint: {
            title: 'vault.passkey_setup.hint_not_saved_title',
            body: 'vault.passkey_setup.hint_not_saved_body',
        },
    },
    'prf-unsupported': {
        error: 'vault.passkey_setup.error_prf_unsupported',
        hint: {
            title: 'vault.passkey_setup.hint_prf_title',
            body: 'vault.passkey_setup.hint_prf_body',
        },
    },
    unexpected: {
        error: 'vault.passkey_setup.error_unexpected',
        hint: null,
    },
}

type PasskeySetupFailureProps = {
    status: PasskeyUnlockSetupFailure
    testID?: string
}

export const PasskeySetupFailure = ({
    status,
    testID = 'passkey-unlock-setup',
}: PasskeySetupFailureProps): React.JSX.Element => {
    const styles = useStyles()
    const { t } = useLanguage()
    const copy = COPY[status]

    return (
        <PWView style={styles.container}>
            <PWText
                variant='body'
                style={styles.errorText}
                testID={`${testID}-error`}
            >
                {t(copy.error)}
            </PWText>
            {copy.hint && (
                <InfoCallout
                    icon='shield-warning'
                    title={t(copy.hint.title)}
                    body={t(copy.hint.body)}
                    testID={`${testID}-hint`}
                />
            )}
        </PWView>
    )
}
