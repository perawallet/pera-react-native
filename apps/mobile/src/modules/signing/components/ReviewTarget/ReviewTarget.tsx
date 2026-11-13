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

export type ReviewTargetStatus = 'verified' | 'unverified'

export type ReviewTargetProps = {
    /** A contract's label, or a short address when it has none. */
    label: string
    /** Unset for a target that is neither, such as a recipient. */
    status?: ReviewTargetStatus
    testID?: string
}

export const ReviewTarget = ({
    label,
    status,
    testID = 'review_target',
}: ReviewTargetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView
            style={styles.container}
            testID={testID}
        >
            <PWText
                style={styles.label}
                numberOfLines={1}
            >
                {label}
            </PWText>
            {status === 'verified' && (
                <PWIcon
                    name='check'
                    size='sm'
                    variant='positive'
                    testID={`${testID}_verified`}
                />
            )}
            {status === 'unverified' && (
                <PWView
                    style={styles.pill}
                    testID={`${testID}_unverified`}
                >
                    <PWText
                        variant='captionMedium'
                        weight={600}
                        style={styles.pillLabel}
                    >
                        {t('signing.review.unverified')}
                    </PWText>
                </PWView>
            )}
        </PWView>
    )
}
