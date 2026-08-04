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

import type { InboxItem as InboxItemModel } from '@perawallet/wallet-core-messages'
import {
    getAccountDisplayName,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import { PWIcon } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { AccountIcon } from '@modules/accounts/components/AccountIcon'
import { InboxItemShell } from '../InboxItemShell'

type AsaInboxItemModel = Extract<InboxItemModel, { type: 'asa_inbox' }>

export type AsaInboxItemProps = {
    item: AsaInboxItemModel
    onPress?: () => void
}

export const AsaInboxItem = ({ item, onPress }: AsaInboxItemProps) => {
    const { t } = useLanguage()
    const accounts = useAllAccounts()
    const account = accounts.find(acc => acc.address === item.data.address)

    const icon = account ? (
        <AccountIcon
            account={account}
            size='lg'
        />
    ) : (
        <PWIcon
            name='inbox'
            variant='secondary'
            size='lg'
        />
    )

    return (
        <InboxItemShell
            item={item}
            onPress={onPress}
            testID='asa_inbox_item'
            icon={icon}
            title={t('messages.inbox.asa_requests', {
                count: item.data.requestCount,
            })}
            subtitle={getAccountDisplayName(account ?? null)}
        />
    )
}
