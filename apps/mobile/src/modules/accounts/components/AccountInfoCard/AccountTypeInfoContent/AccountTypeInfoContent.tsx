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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useAccountTypeInfo } from './useAccountTypeInfo'
import { AccountIcon } from '../../AccountIcon'

export type AccountTypeInfoContentProps = {
    account: WalletAccount
}

export const AccountTypeInfoContent = ({
    account,
}: AccountTypeInfoContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { title, titleQualifier, description, handleLearnMore } =
        useAccountTypeInfo({
            account,
        })

    return (
        <PWView style={styles.container}>
            <PWView style={styles.header}>
                <AccountIcon
                    account={account}
                    size='xl'
                />
                <PWView style={styles.titleContainer}>
                    <PWText
                        variant='h3'
                        style={styles.title}
                        truncate
                    >
                        {title}
                    </PWText>
                    {titleQualifier ? (
                        <PWText
                            variant='body'
                            style={styles.titleQualifier}
                            truncate
                        >
                            {titleQualifier}
                        </PWText>
                    ) : null}
                </PWView>
            </PWView>

            <PWText style={styles.description}>{description}</PWText>

            <PWTouchableOpacity
                style={styles.learnMoreRow}
                onPress={handleLearnMore}
                testID='account-type-info-learn-more-button'
            >
                <PWIcon
                    name='info'
                    size='sm'
                    variant='link'
                />
                <PWText
                    variant='link'
                    style={styles.learnMoreText}
                    truncate
                >
                    {t('account_type_info.learn_more')}
                </PWText>
            </PWTouchableOpacity>
        </PWView>
    )
}
