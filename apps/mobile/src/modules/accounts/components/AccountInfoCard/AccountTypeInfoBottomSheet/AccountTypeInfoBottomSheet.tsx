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
    PWButton,
    PWDivider,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useAccountTypeInfo } from './useAccountTypeInfo'
import { AccountIcon } from '../../AccountIcon'

export type AccountTypeInfoContentProps = {
    account: WalletAccount
    onClose: () => void
}

export const AccountTypeInfoContent = ({
    account,
    onClose,
}: AccountTypeInfoContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { title, description, actions, handleLearnMore } = useAccountTypeInfo(
        { account, onClose },
    )

    return (
        <PWView style={styles.container}>
            <PWView style={styles.header}>
                <AccountIcon
                    account={account}
                    size='md'
                />
                <PWText variant='h3'>{title}</PWText>
            </PWView>

            <PWText style={styles.description}>{description}</PWText>

            <PWView style={styles.linkContainer}>
                <PWButton
                    variant='link'
                    icon='info'
                    title={t('account_type_info.learn_more')}
                    paddingStyle='none'
                    onPress={handleLearnMore}
                    testID='account-type-info-learn-more-button'
                />
            </PWView>

            {actions.length > 0 && (
                <>
                    <PWDivider />
                    <PWView style={styles.actionsContainer}>
                        {actions.map(action => (
                            <PWTouchableOpacity
                                key={action.id}
                                onPress={action.onPress}
                                style={styles.actionRow}
                                testID={`account-type-action-${action.id}`}
                            >
                                <PWIcon
                                    name={action.icon}
                                    size='sm'
                                    variant='secondary'
                                />
                                <PWText variant='body'>{action.title}</PWText>
                            </PWTouchableOpacity>
                        ))}
                    </PWView>
                </>
            )}
        </PWView>
    )
}
