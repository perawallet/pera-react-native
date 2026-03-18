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

import {
    PWBottomSheet,
    PWIcon,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { PanelButton } from '@components/PanelButton'
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'
import { useSigningPipeline } from '@perawallet/wallet-core-signing'
import { useStyles } from './styles'
import { WarningItem } from './WarningItem'

export const SigningWarnings = ({ isGroup = false }: { isGroup?: boolean }) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { distinctWarnings, warnings } = useSigningPipeline()
    const { isOpen, open, close } = useModalState()

    if (distinctWarnings.length === 0) {
        return null
    }

    const warningCount = warnings.length

    return (
        <>
            <PWView style={styles.warningContainer}>
                <PanelButton
                    onPress={open}
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
                    style={styles.panelButton}
                />

                <PWBottomSheet isVisible={isOpen}>
                    <PWView style={styles.sheetContainer}>
                        <PWToolbar
                            left={
                                <PWIcon
                                    name='cross'
                                    variant='secondary'
                                    onPress={close}
                                />
                            }
                            center={
                                <PWText variant='h4'>
                                    {t('transactions.warning.title', {
                                        count: warningCount,
                                    })}
                                </PWText>
                            }
                            paddingStyle='dense'
                        />

                        {distinctWarnings.map((warning, index) => (
                            <WarningItem
                                key={`${warning.type}-${warning.senderAddress}-${warning.targetAddress}`}
                                warning={warning}
                                showDivider={index > 0}
                                isGroup={isGroup}
                            />
                        ))}
                    </PWView>
                </PWBottomSheet>
            </PWView>
        </>
    )
}
