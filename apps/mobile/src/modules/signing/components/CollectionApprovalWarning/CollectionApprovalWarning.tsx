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
import { PWText, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { KeyValueRow } from '@components/KeyValueRow'
import { PanelButton } from '@components/PanelButton'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheet } from '@modules/bottom-sheet'
import { SpendApprovalWarningContent } from '../SpendApprovalWarning/SpendApprovalWarningContent'
import { useStyles } from './styles'
import { useCollectionApprovalWarning } from './useCollectionApprovalWarning'

export type CollectionApprovalWarningProps = {
    operator: string
    /** The collection's contract address. */
    collection: string
    collectionName?: string
}

export const CollectionApprovalWarning = ({
    operator,
    collection,
    collectionName,
}: CollectionApprovalWarningProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { rows } = useCollectionApprovalWarning(operator)
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
                testID='collection-approval-warning'
            />
            <KeyValueRow
                testID='collection-approval-operator'
                title={t('signing.collection_approval.operator_label')}
            >
                <AddressDisplay
                    address={operator}
                    displayType='address-only'
                />
            </KeyValueRow>
            <KeyValueRow
                testID='collection-approval-collection'
                title={t('signing.collection_approval.collection_label')}
            >
                <PWView style={styles.collection}>
                    {!!collectionName && <PWText>{collectionName}</PWText>}
                    <AddressDisplay
                        address={collection}
                        displayType='address-only'
                    />
                </PWView>
            </KeyValueRow>
        </PWView>
    )
}
