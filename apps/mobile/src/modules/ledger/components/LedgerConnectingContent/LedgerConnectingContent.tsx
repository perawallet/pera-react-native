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

import React from 'react'
import { PWView, PWText, PWButton } from '@components/core'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { LedgerCompositeIcon } from '../LedgerCompositeIcon'
import { useStyles } from './styles'

export const LedgerConnectingContent = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { resolve } = useBottomSheetResult<'cancel'>()

    return (
        <PWView style={styles.container}>
            <LedgerCompositeIcon />
            <PWText
                variant='h3'
                style={styles.title}
            >
                {t('ledger.connecting.title')}
            </PWText>
            <PWText
                variant='body'
                style={styles.subtitle}
            >
                {t('ledger.connecting.subtitle')}
            </PWText>
            <PWButton
                variant='secondary'
                title={t('ledger.connecting.cancel')}
                onPress={() => resolve('cancel')}
                style={styles.button}
                testID='ledger_connecting_cancel_button'
            />
        </PWView>
    )
}
