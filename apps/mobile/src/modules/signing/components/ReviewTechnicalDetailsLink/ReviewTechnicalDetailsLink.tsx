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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type ReviewTechnicalDetailsLinkProps = {
    /** What the details page holds for this chain. */
    subtitle: string
    onPress: () => void
    testID?: string
}

export const ReviewTechnicalDetailsLink = ({
    subtitle,
    onPress,
    testID = 'review_technical_details',
}: ReviewTechnicalDetailsLinkProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWTouchableOpacity
            style={styles.row}
            onPress={onPress}
            testID={testID}
        >
            <PWView style={styles.text}>
                <PWText
                    variant='h4'
                    style={styles.title}
                >
                    {t('signing.review.technical_details')}
                </PWText>
                <PWText style={styles.subtitle}>{subtitle}</PWText>
            </PWView>
            <PWIcon
                name='chevron-right'
                variant='positive'
            />
        </PWTouchableOpacity>
    )
}
