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
import {
    PWIcon,
    PWSheetLayout,
    PWText,
    PWTouchableOpacity,
} from '@components/core'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type ManageNftsAction = 'sort' | 'filter'

export type ManageNftsContentProps = Record<string, never>

export const ManageNftsContent = (_: ManageNftsContentProps = {}) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { resolve } = useBottomSheetResult<ManageNftsAction>()

    return (
        <PWSheetLayout
            header={
                <SheetHeader title={t('account_details.nfts.manage_title')} />
            }
            bodyStyle={styles.contentContainer}
        >
            <PWTouchableOpacity
                style={styles.menuRow}
                onPress={() => resolve('sort')}
            >
                <PWIcon
                    name='list-arrow-down'
                    size='md'
                />
                <PWText variant='body'>{t('account_details.nfts.sort')}</PWText>
            </PWTouchableOpacity>

            <PWTouchableOpacity
                style={styles.menuRow}
                onPress={() => resolve('filter')}
            >
                <PWIcon
                    name='funnel'
                    size='md'
                />
                <PWText variant='body'>
                    {t('account_details.nfts.filter')}
                </PWText>
            </PWTouchableOpacity>
        </PWSheetLayout>
    )
}
