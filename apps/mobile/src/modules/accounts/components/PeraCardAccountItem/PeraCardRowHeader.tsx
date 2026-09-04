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

import type { ReactNode } from 'react'
import { PWRoundIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type PeraCardRowHeaderProps = {
    /** The second line under the title (subtitle or status row). */
    children: ReactNode
}

export const PeraCardRowHeader = ({ children }: PeraCardRowHeaderProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.leftBlock}>
            <PWRoundIcon
                icon='card'
                variant='primary'
                size='md'
            />
            <PWView style={styles.textBlock}>
                <PWText
                    variant='bodyLarge'
                    weight={500}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                >
                    {t('peraCard.account_item.title')}
                </PWText>
                {children}
            </PWView>
        </PWView>
    )
}
