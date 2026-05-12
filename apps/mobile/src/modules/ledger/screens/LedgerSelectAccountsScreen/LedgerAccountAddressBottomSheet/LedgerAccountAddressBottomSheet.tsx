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
import { PWBottomSheet, PWView, PWText, PWButton } from '@components/core'
import { useClipboard } from '@hooks/useClipboard'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type LedgerAccountAddressBottomSheetProps = {
    isVisible: boolean
    address: string
    onDismiss: () => void
}

export const LedgerAccountAddressBottomSheet = ({
    isVisible,
    address,
    onDismiss,
}: LedgerAccountAddressBottomSheetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { copyToClipboard } = useClipboard()

    const handleCopy = useCallback(() => {
        copyToClipboard(address)
    }, [address, copyToClipboard])

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onDismiss={onDismiss}
            enablePanDownToClose={true}
        >
            <PWView style={styles.container}>
                <PWText variant='h3'>
                    {t('ledger.select_accounts.address_sheet_title')}
                </PWText>
                <PWText
                    variant='body'
                    style={styles.address}
                >
                    {address}
                </PWText>
                <PWButton
                    variant='secondary'
                    title={t('common.copy_address')}
                    onPress={handleCopy}
                    testID='ledger_account_address_copy_button'
                />
            </PWView>
        </PWBottomSheet>
    )
}
