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

import { PWView } from '@components/core'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLanguage } from '@hooks/useLanguage'
import { SigningWarnings } from '@modules/signing/components/SigningWarnings'
import { FeeDisplay } from '@modules/signing/components/FeeDisplay'
import { SigningActionButtons } from '@modules/signing/components/SigningActionButtons'
import { useStyles } from './styles'

export const TransactionListFooter = () => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <SafeAreaView
            edges={['bottom']}
            style={styles.footerContainer}
        >
            <SigningWarnings isGroup />

            <PWView style={styles.feeContainer}>
                <FeeDisplay label={t('transactions.common.total_fee')} />
            </PWView>

            <SigningActionButtons />
        </SafeAreaView>
    )
}
