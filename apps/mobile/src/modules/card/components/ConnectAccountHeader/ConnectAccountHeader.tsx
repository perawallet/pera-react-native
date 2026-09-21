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
import { PWButton, PWText, PWView } from '@components/core'
import type { AccountMenuContentResult } from '@modules/accounts/components/AccountMenuContent'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

// The whole account-menu header for the card flow: the picker passes
// hideDefaultHeader, so the accounts row is rebuilt here rather than trimmed
// with props on the shared menu. Sorting is deliberately absent: the list
// follows whatever order the account overview is set to.
export const ConnectAccountHeader = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { resolve } = useBottomSheetResult<AccountMenuContentResult>()

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
            <PWView
                style={styles.titleBar}
                accessible={false}
            >
                <PWView style={styles.titleBarTitleContainer}>
                    <PWText
                        variant='h3'
                        style={styles.accountsTitle}
                        truncate
                    >
                        {t('account_menu.title')}
                    </PWText>
                </PWView>
                <PWButton
                    testID='card_connect_create_account_button'
                    accessibilityLabel='card_connect_create_account_button'
                    variant='helper'
                    icon='plus'
                    title={t('peraCard.connect_account.create_account')}
                    paddingStyle='dense'
                    onPress={() => resolve({ kind: 'add-account' })}
                />
            </PWView>
        </PWView>
    )
}
