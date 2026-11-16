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

import { PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type FolderHeaderTitleProps = { name: string; count: number }

/**
 * The folder screen's title. A component, not a title string: the navigation
 * header runs dotted strings (`web3.apps`) through i18n.
 */
export const FolderHeaderTitle = ({ name, count }: FolderHeaderTitleProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.headerTitle}>
            <PWText
                variant='h4'
                numberOfLines={1}
                testID='discover_folder_title'
            >
                {name}
            </PWText>
            <PWText
                variant='caption'
                style={styles.headerCount}
            >
                {t('discover.favorites.dapp_count', { count })}
            </PWText>
        </PWView>
    )
}
