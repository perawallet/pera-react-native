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

import { useCallback, useState } from 'react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import { deferToNextCycle, type Nullable } from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useErrorToast } from '@hooks/useErrorToast'
import { useIsMounted } from '@hooks/useIsMounted'
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'

// A key kind's create option can override it for its own keygen.
const DEFAULT_CREATING_TITLE_KEY = i18nKey(
    'onboarding.create_account.processing',
)

export type UseRunCreateAccountResult = {
    isCreatingAccount: boolean
    creatingTitleKey: I18nKey
    runCreateAccount: (
        create: () => Promise<Nullable<WalletAccount>>,
        titleKey?: I18nKey,
    ) => void
}

export const useRunCreateAccount = (): UseRunCreateAccountResult => {
    const navigation = useAppNavigation()
    const isMounted = useIsMounted()
    const { showError } = useErrorToast()
    const { t } = useLanguage()
    const {
        isOpen: isCreatingAccount,
        open: openCreatingAccount,
        close: closeCreatingAccount,
    } = useModalState()
    const [creatingTitleKey, setCreatingTitleKey] = useState(
        DEFAULT_CREATING_TITLE_KEY,
    )

    const runCreateAccount = useCallback(
        (
            create: () => Promise<Nullable<WalletAccount>>,
            titleKey: I18nKey = DEFAULT_CREATING_TITLE_KEY,
        ) => {
            setCreatingTitleKey(titleKey)
            openCreatingAccount()
            void deferToNextCycle(async () => {
                try {
                    const newAccount = await create()
                    if (!isMounted()) return
                    if (newAccount) {
                        navigation.push('NameAccount', { account: newAccount })
                    }
                } catch (error) {
                    if (!isMounted()) return
                    showError(error, t('onboarding.create_account.error_title'))
                } finally {
                    if (isMounted()) closeCreatingAccount()
                }
            })
        },
        [
            isMounted,
            openCreatingAccount,
            closeCreatingAccount,
            navigation,
            showError,
            t,
        ],
    )

    return { isCreatingAccount, creatingTitleKey, runCreateAccount }
}
