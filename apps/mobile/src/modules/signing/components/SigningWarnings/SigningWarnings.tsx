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

import { useCallback } from 'react'
import { PWView } from '@components/core'
import { PanelButton } from '@components/PanelButton'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useSigningPipeline } from '@perawallet/wallet-core-signing'
import { useStyles } from './styles'
import { SigningWarningsContent } from './SigningWarningsContent'

export const SigningWarnings = ({ isGroup = false }: { isGroup?: boolean }) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { distinctWarnings, warnings } = useSigningPipeline()
    const { request: requestBottomSheet } = useBottomSheet()

    const handleOpen = useCallback(() => {
        void requestBottomSheet({
            contents: <SigningWarningsContent isGroup={isGroup} />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet, isGroup])

    if (distinctWarnings.length === 0) {
        return null
    }

    const warningCount = warnings.length

    return (
        <PWView style={styles.warningContainer}>
            <PanelButton
                onPress={handleOpen}
                title={t('transactions.warning.title')}
                titleWeight='h4'
                description={t(
                    isGroup
                        ? 'transactions.warning.title_cta_group'
                        : 'transactions.warning.title_cta',
                    {
                        count: warningCount,
                    },
                )}
                leftIcon='info'
                rightIcon='chevron-right'
                variant='error'
                paddingStyle='dense'
                style={styles.panelButton}
            />
        </PWView>
    )
}
