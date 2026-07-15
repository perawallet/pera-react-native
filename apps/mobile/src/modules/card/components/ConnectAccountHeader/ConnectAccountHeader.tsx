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
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

// Replaces the account menu's default portfolio summary with the card flow's
// "Choose Card account" heading. Passed to AccountMenu via its headerContent
// prop (the same mechanism the swap/onramp account pickers use).
export const ConnectAccountHeader = () => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.pickerHeader}>
            <PWText
                variant='h1'
                style={styles.pickerHeaderTitle}
            >
                {t('peraCard.connect_account.title')}
            </PWText>
            <PWText
                variant='body'
                weight={400}
                style={styles.pickerHeaderSubtitle}
            >
                {t('peraCard.connect_account.subtitle')}
            </PWText>
        </PWView>
    )
}
