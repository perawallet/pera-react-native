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

import { PWText, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type GrantRowsProps = {
    spenderTitle: string
    spender: string
    assetText?: string
    contract: string
    isRevocation: boolean
}

export const GrantRows = ({
    spenderTitle,
    spender,
    assetText,
    contract,
    isRevocation,
}: GrantRowsProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <>
            <KeyValueRow
                testID='ethereum_approval_spender'
                title={spenderTitle}
            >
                <AddressDisplay
                    address={spender}
                    displayType='address-only'
                />
            </KeyValueRow>
            <KeyValueRow
                testID='ethereum_approval_asset'
                title={t('transactions.common.asset')}
            >
                <PWView style={styles.asset}>
                    {!!assetText && <PWText>{assetText}</PWText>}
                    <AddressDisplay
                        address={contract}
                        displayType='address-only'
                    />
                </PWView>
            </KeyValueRow>
            {isRevocation && (
                <PWText
                    testID='ethereum_approval_revoke_note'
                    variant='caption'
                    style={styles.note}
                >
                    {t('signing.token_approval.revoke_note')}
                </PWText>
            )}
        </>
    )
}
