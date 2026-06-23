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

import { ActivityIndicator } from 'react-native'
import { PWSheetLayout, PWText, PWView } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import { SheetHeader } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import {
    useCardAccountDetailsSheet,
    type KycTone,
} from './useCardAccountDetailsSheet'
import { useStyles } from './styles'

export const CardAccountDetailsSheet = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { isLoading, details, kyc } = useCardAccountDetailsSheet()

    const kycStyles: Record<KycTone, object> = {
        verified: styles.kycVerified,
        pending: styles.kycPending,
        rejected: styles.kycRejected,
        unverified: styles.kycUnverified,
    }

    return (
        <PWSheetLayout
            header={<SheetHeader title={t('peraCard.account_details.title')} />}
        >
            {isLoading ? (
                <ActivityIndicator />
            ) : (
                <PWView style={styles.rows}>
                    {details.map(detail => (
                        <KeyValueRow
                            key={detail.key}
                            title={detail.label}
                        >
                            <PWText
                                variant='body'
                                style={styles.value}
                            >
                                {detail.value}
                            </PWText>
                        </KeyValueRow>
                    ))}
                    <KeyValueRow
                        title={t('peraCard.account_details.verification')}
                    >
                        <PWText
                            variant='body'
                            weight={500}
                            style={kycStyles[kyc.tone]}
                        >
                            {kyc.label}
                        </PWText>
                    </KeyValueRow>
                </PWView>
            )}
        </PWSheetLayout>
    )
}
