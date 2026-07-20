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

import { PWRoundIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type RecipientBelowMbrWarningProps = {
    minBalance: string
}

export const RecipientBelowMbrWarning = ({
    minBalance,
}: RecipientBelowMbrWarningProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView
            style={styles.recipientMbrContainer}
            testID='recipient_below_mbr_warning'
        >
            <PWRoundIcon
                icon='info'
                size='md'
                variant='error'
            />
            <PWView style={styles.recipientMbrMessageContainer}>
                <PWText style={styles.recipientMbrMessage}>
                    {t('send_funds.confirmation.recipient_below_mbr.body', {
                        min: minBalance,
                    })}
                </PWText>
            </PWView>
        </PWView>
    )
}
