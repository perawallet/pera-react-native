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

import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { PWText } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import { CopyableText } from '@components/CopyableText'
import type { AlgorandTransactionView } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { ALGORAND_CHAIN_ID } from '@perawallet/wallet-core-chain-algorand/descriptor'
import { useLanguage } from '@hooks/useLanguage'
import {
    TransactionDetailAddress,
    TransactionDetailCard,
} from '@modules/signing'
import { useStyles } from './styles'

export type AssetFreezeDisplayProps = {
    transaction: AlgorandTransactionView
}

export const AssetFreezeDisplay = ({
    transaction,
}: AssetFreezeDisplayProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const scope = useSelectedScope(ALGORAND_CHAIN_ID)

    const assetFreeze = transaction.assetFreezeTransaction
    if (!assetFreeze) {
        return null
    }

    const isFreezing = assetFreeze.newFreezeStatus
    const assetId = assetFreeze.assetId.toString()

    return (
        <TransactionDetailCard>
            <KeyValueRow title={t('transactions.common.asset_id')}>
                <CopyableText copyValue={assetId}>
                    <PWText>{assetId}</PWText>
                </CopyableText>
            </KeyValueRow>

            <KeyValueRow title={t('transactions.asset_freeze.target')}>
                <TransactionDetailAddress
                    address={assetFreeze.address}
                    scope={scope}
                />
            </KeyValueRow>

            <KeyValueRow title={t('transactions.asset_freeze.status')}>
                <PWText
                    style={
                        isFreezing ? styles.frozenStatus : styles.unfrozenStatus
                    }
                >
                    {isFreezing
                        ? t('transactions.asset_freeze.frozen')
                        : t('transactions.asset_freeze.unfrozen')}
                </PWText>
            </KeyValueRow>
        </TransactionDetailCard>
    )
}
