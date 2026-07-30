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

import { memo } from 'react'
import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type AccountHistoryTitleBarProps = {
    isCsvExportVisible: boolean
    isExportingCsv: boolean
    onOpenFilter: () => void
    onExportCsv: () => void
}

/**
 * Title + filter/export actions for the History tab. Rendered as the populated
 * list's `ListHeaderComponent` and standalone in the loading/empty branches, so
 * the tab keeps its header in every state. Memoized because SectionList hands
 * the header a fresh element on every parent render.
 */
export const AccountHistoryTitleBar = memo(
    ({
        isCsvExportVisible,
        isExportingCsv,
        onOpenFilter,
        onExportCsv,
    }: AccountHistoryTitleBarProps) => {
        const styles = useStyles()
        const { t } = useLanguage()

        return (
            <PWView style={styles.headerContainer}>
                <PWView style={styles.titleBar}>
                    <PWView style={styles.titleBarTitleContainer}>
                        <PWText
                            variant='h4'
                            truncate
                        >
                            {t('asset_details.transaction_list.title')}
                        </PWText>
                    </PWView>
                    <PWView style={styles.titleBarButtonContainer}>
                        <PWButton
                            icon='sliders'
                            title={t('asset_details.transaction_list.filter')}
                            variant='helper'
                            style={styles.transparentButton}
                            paddingStyle='dense'
                            onPress={onOpenFilter}
                        />
                        {isCsvExportVisible && (
                            <PWButton
                                icon='document-download'
                                title={t('asset_details.transaction_list.csv')}
                                variant='helper'
                                paddingStyle='dense'
                                onPress={onExportCsv}
                                isLoading={isExportingCsv}
                            />
                        )}
                    </PWView>
                </PWView>
            </PWView>
        )
    },
)
