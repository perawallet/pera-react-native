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
    encodeAlgorandAddress,
    PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useFindAccountByAddress } from '@perawallet/wallet-core-accounts'
import { AddressDisplay } from '@components/AddressDisplay'
import { useStyles } from './styles'
import { PWView, PWText } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'

export const SigningAccountDisplay = ({
    transaction,
}: {
    transaction: PeraDisplayableTransaction
}) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const authAddress = transaction.authAddr?.publicKey
        ? encodeAlgorandAddress(transaction.authAddr.publicKey)
        : transaction.sender
    const signingAccount = useFindAccountByAddress(authAddress)

    if (!signingAccount) {
        return null
    }

    return (
        <PWView style={styles.container}>
            <PWText style={styles.title}>
                {t('signing.transactions.signing_with')}
            </PWText>
            <AddressDisplay
                style={styles.fromAddress}
                address={signingAccount.address}
                showCopy={false}
            />
        </PWView>
    )
}
