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

import { PWResultView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useTransactionSuccessScreen } from './useTransactionSuccessScreen'

const titleKey = {
    close_account: 'send_funds.close_account.success_title',
    asset_transfer: 'send_funds.success.asset_transferred_title',
    claim: 'messages.claim.success_title',
    reject: 'messages.claim.success_title',
    payment: 'send_funds.success.title',
}

const subtitleKey = {
    close_account: 'send_funds.close_account.success_subtitle',
    asset_transfer: 'send_funds.success.subtitle',
    claim: 'messages.claim.success_subtitle',
    reject: 'messages.claim.success_subtitle',
    payment: 'send_funds.success.subtitle',
}

export const TransactionSuccessScreen = () => {
    const { t } = useLanguage()
    const { handleDone, handleViewInExplorer, variant } =
        useTransactionSuccessScreen()

    return (
        <PWResultView
            variant='success'
            testID='send_success'
            title={t(titleKey[variant] ?? titleKey['payment'])}
            body={t(subtitleKey[variant] ?? subtitleKey['payment'])}
            linkAction={
                handleViewInExplorer && {
                    label: t('send_funds.success.view_in_explorer'),
                    onPress: handleViewInExplorer,
                }
            }
            primaryAction={{
                label: t('send_funds.success.done'),
                onPress: handleDone,
            }}
        />
    )
}
