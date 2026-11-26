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
    accountChainIdOf,
    getAccountDisplayName,
    useRegisteredChainIds,
} from '@perawallet/wallet-core-accounts'
import { AccountIcon } from '@components/AccountIcon'
import { useLanguage } from '@hooks/useLanguage'
import type { AccountAssetsInboxItem as AccountAssetsInboxItemModel } from '@modules/messages/hooks/useAccountAssetInboxes'
import { InboxItemShell } from '../InboxItemShell'

export type AccountAssetsInboxItemProps = {
    item: AccountAssetsInboxItemModel
    onPress?: () => void
}

export const AccountAssetsInboxItem = ({
    item,
    onPress,
}: AccountAssetsInboxItemProps) => {
    const { t } = useLanguage()
    const { account, requestCount } = item.data
    const chainId = accountChainIdOf(account, useRegisteredChainIds())

    return (
        <InboxItemShell
            isUnread
            onPress={onPress}
            testID='account_assets_inbox_item'
            icon={
                <AccountIcon
                    account={account}
                    size='lg'
                />
            }
            title={t('messages.inbox.asa_requests', { count: requestCount })}
            subtitle={getAccountDisplayName(account, chainId)}
        />
    )
}
