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

export type SectionHeadingProps = {
    title: string
    subtitle: string
    count?: number
}

export const SectionHeading = ({
    title,
    subtitle,
    count,
}: SectionHeadingProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView>
            <PWView style={styles.titleRow}>
                <PWText
                    variant='bodyLarge'
                    weight={500}
                >
                    {title}
                </PWText>
                {count != null && (
                    <PWText
                        variant='bodyLarge'
                        style={styles.count}
                    >
                        {t('cloud_backup.accounts.count_label', { count })}
                    </PWText>
                )}
            </PWView>
            <PWText
                variant='body'
                style={styles.subtitle}
            >
                {subtitle}
            </PWText>
        </PWView>
    )
}
