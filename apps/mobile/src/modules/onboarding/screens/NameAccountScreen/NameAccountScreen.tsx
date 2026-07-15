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
import { NameAccountForm } from '@components/NameAccountForm'
import { AccountIcon } from '@modules/accounts/components/AccountIcon'
import { useLanguage } from '@hooks/useLanguage'
import { getAccountDisplayName } from '@perawallet/wallet-core-accounts'
import { useNameAccountScreen } from './useNameAccountScreen'
import { useStyles } from './styles'

export const NameAccountScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        walletDisplay,
        isCreating,
        handleNameChange,
        handleFinish,
        numWallets,
        account,
    } = useNameAccountScreen()

    return (
        <NameAccountForm
            title={t('onboarding.name_account.title')}
            description={t('onboarding.name_account.description')}
            finishButtonTitle={t('onboarding.name_account.finish_button')}
            loadingTitle={t('onboarding.create_account.processing')}
            value={walletDisplay}
            onChangeText={handleNameChange}
            onFinish={() => void handleFinish()}
            isLoading={isCreating}
        >
            <PWView style={styles.walletNameContainer}>
                <AccountIcon account={account} />
                <PWText
                    variant='h4'
                    style={styles.nameText}
                >
                    {account
                        ? getAccountDisplayName(account)
                        : t('onboarding.name_account.wallet_label', {
                              count: numWallets + 1,
                          })}
                </PWText>
            </PWView>
        </NameAccountForm>
    )
}
