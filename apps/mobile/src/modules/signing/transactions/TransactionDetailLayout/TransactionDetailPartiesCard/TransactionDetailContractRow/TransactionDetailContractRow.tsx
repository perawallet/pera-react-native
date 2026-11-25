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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { PWView } from '@components/core'
import { KnownContractName } from '@components/KnownContractName'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import { TransactionDetailAddress } from '@modules/signing/transactions/TransactionDetailAddress'
import type { TransactionDetailContract } from '@modules/signing/transactions/types'
import { useStyles } from './styles'

type TransactionDetailContractRowProps = {
    contract: TransactionDetailContract
    scope: ChainScope
}

/** The contract a call went to, under the name the review gave it when known. */
export const TransactionDetailContractRow = ({
    contract,
    scope,
}: TransactionDetailContractRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <KeyValueRow
            testID='transaction_detail_contract'
            title={t('transactions.record_detail.contract')}
            verticalAlignment='top'
        >
            <PWView style={styles.container}>
                {!!contract.name && (
                    <KnownContractName
                        name={contract.name}
                        variant='bodyLarge'
                        style={styles.name}
                        testID='transaction_detail_contract_name'
                        shouldTruncate
                    />
                )}
                <TransactionDetailAddress
                    address={contract.address}
                    scope={scope}
                />
            </PWView>
        </KeyValueRow>
    )
}
