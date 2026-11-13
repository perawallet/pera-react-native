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

import { PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type PreviewUnavailableCardProps = {
    /** The requesting site, named in the tip; a generic tip without one. */
    host?: string
}

export const PreviewUnavailableCard = ({
    host,
}: PreviewUnavailableCardProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView
            style={styles.container}
            testID='review_preview_unavailable'
        >
            <PWView style={styles.heading}>
                <PWIcon
                    name='warning'
                    size='sm'
                    variant='warning'
                />
                <PWText
                    variant='h4'
                    style={styles.title}
                >
                    {t('signing.review.preview_unavailable_title')}
                </PWText>
            </PWView>
            <PWText style={styles.body}>
                {t('signing.review.preview_unavailable_body')}
            </PWText>
            <PWView style={styles.tip}>
                <PWIcon
                    name='shield-check'
                    size='sm'
                    variant='warning'
                    style={styles.tipIcon}
                />
                <PWText style={styles.tipText}>
                    {host
                        ? t('signing.review.preview_unavailable_tip', { host })
                        : t('signing.review.preview_unavailable_tip_generic')}
                </PWText>
            </PWView>
        </PWView>
    )
}
