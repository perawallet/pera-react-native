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

import { useCallback } from 'react'
import type {
    ChainScope,
    SpendApproval,
} from '@perawallet/wallet-core-chain-contract'
import { PWText, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { KeyValueRow } from '@components/KeyValueRow'
import { PanelButton } from '@components/PanelButton'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheet } from '@modules/bottom-sheet'
import { SpendAllowanceRow } from './SpendAllowanceRow'
import { SpendApprovalWarningContent } from './SpendApprovalWarningContent'
import { useStyles } from './styles'
import { useSpendApprovalWarning } from './useSpendApprovalWarning'

export type SpendApprovalWarningProps = {
    approval: SpendApproval
    scope: ChainScope
}

export const SpendApprovalWarning = ({
    approval,
    scope,
}: SpendApprovalWarningProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { rows, deadlineText } = useSpendApprovalWarning(approval)
    const { request: requestBottomSheet } = useBottomSheet()

    const handleOpen = useCallback(() => {
        void requestBottomSheet({
            contents: <SpendApprovalWarningContent rows={rows} />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet, rows])

    return (
        <PWView style={styles.container}>
            <PanelButton
                onPress={handleOpen}
                title={t('transactions.warning.title')}
                titleWeight='h4'
                description={t('transactions.warning.title_cta', {
                    count: rows.length,
                })}
                leftIcon='info'
                rightIcon='chevron-right'
                variant='error'
                paddingStyle='dense'
                style={styles.panelButton}
                testID='message-signing-spend-approval-warning'
            />
            <KeyValueRow
                testID='message-signing-spend-approval-spender'
                title={t('signing.spend_approval.spender_label')}
            >
                <AddressDisplay
                    address={approval.spender}
                    displayType='address-only'
                />
            </KeyValueRow>
            {approval.allowances.map((allowance, index) => (
                <SpendAllowanceRow
                    key={`${index}-${allowance.assetRef.assetId}`}
                    allowance={allowance}
                    scope={scope}
                    index={index}
                />
            ))}
            <KeyValueRow
                testID='message-signing-spend-approval-deadline'
                title={t('signing.spend_approval.deadline_label')}
            >
                <PWText>{deadlineText}</PWText>
            </KeyValueRow>
        </PWView>
    )
}
