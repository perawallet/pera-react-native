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

import { PWButton, PWText, PWView } from '@components/core'
import type { PeraArbitraryDataMessage } from '@perawallet/wallet-core-signing'
import { useFindAccountByAddress } from '@perawallet/wallet-core-accounts'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type SingleArbitrarySignRequestViewProps = {
    request: PeraArbitraryDataMessage
    onDetailsPress: (message: PeraArbitraryDataMessage) => void
}

export const SingleArbitrarySignRequestView = ({
    request,
    onDetailsPress,
}: SingleArbitrarySignRequestViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const account = useFindAccountByAddress(request.signer)

    const handleDetailsPress = () => {
        onDetailsPress(request)
    }

    return (
        <PWView style={styles.container}>
            <PWView style={styles.messageContainer}>
                <PWText
                    variant='h1'
                    style={styles.body}
                >
                    {t('signing.arbitrary_data_view.body')}
                </PWText>
                <PWText style={styles.message}>{request.message}</PWText>
                {!!account && (
                    <PWView style={styles.accountContainer}>
                        <PWText style={styles.onBehalfOf}>
                            {t('signing.arbitrary_data_view.on_behalf_of')}
                        </PWText>
                        <AccountDisplay
                            account={account}
                            showChevron={false}
                        />
                    </PWView>
                )}
            </PWView>
            <PWView style={styles.detailsContainer}>
                <PWButton
                    title={t('signing.arbitrary_data_view.show_details')}
                    variant='link'
                    paddingStyle='dense'
                    onPress={handleDetailsPress}
                />
            </PWView>
        </PWView>
    )
}
