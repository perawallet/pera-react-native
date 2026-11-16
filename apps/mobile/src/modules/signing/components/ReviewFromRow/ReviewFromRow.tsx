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

import {
    chainAccountOf,
    getAccountDisplayName,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { PWText, PWView } from '@components/core'
import { AccountIcon } from '@components/AccountIcon'
import { useLanguage } from '@hooks/useLanguage'
import { ReviewDetailRow } from '../ReviewDetailRow'
import { useStyles } from './styles'

export type ReviewFromRowProps = {
    account: WalletAccount
    /** The chain whose address the row shows. */
    chainId: ChainId
}

export const ReviewFromRow = ({ account, chainId }: ReviewFromRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const address = chainAccountOf(account, chainId)?.address
    const name = getAccountDisplayName(account, chainId)
    const shortAddress =
        address && addressCodecs.has(chainId)
            ? addressCodecs.get(chainId).truncate(address)
            : address

    return (
        <ReviewDetailRow
            label={t('transactions.common.from')}
            testID='review_from'
        >
            <PWView style={styles.value}>
                <AccountIcon
                    account={account}
                    size='sm'
                />
                <PWText
                    variant='h4'
                    style={styles.name}
                    numberOfLines={1}
                >
                    {name}
                </PWText>
                {!!shortAddress && shortAddress !== name && (
                    <PWText style={styles.address}>{shortAddress}</PWText>
                )}
            </PWView>
        </ReviewDetailRow>
    )
}
