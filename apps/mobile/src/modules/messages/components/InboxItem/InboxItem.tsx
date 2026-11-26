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
import type { AccountAssetsInboxItem as AccountAssetsInboxItemModel } from '../../hooks/useAccountAssetInboxes'
import { AccountAssetsInboxItem } from './AccountAssetsInboxItem'
import { MultisigInvitationInboxItem } from './MultisigInvitationInboxItem'
import { MultisigSignInboxItem } from './MultisigSignInboxItem'

export type InboxItemProps = {
    /** The backend's per-address asset rows are listed per account instead. */
    item:
        | Exclude<InboxItemModel, { type: 'asa_inbox' }>
        | AccountAssetsInboxItemModel
    chainBadgeName?: string
    onPress?: () => void
}

export const InboxItem = ({
    item,
    chainBadgeName,
    onPress,
}: InboxItemProps) => {
    switch (item.type) {
        case 'account_assets': {
            return (
                <AccountAssetsInboxItem
                    item={item}
                    onPress={onPress}
                />
            )
        }
        case 'multisig_sign': {
            return (
                <MultisigSignInboxItem
                    item={item}
                    chainBadgeName={chainBadgeName}
                    onPress={onPress}
                />
            )
        }
        case 'multisig_import': {
            return (
                <MultisigInvitationInboxItem
                    item={item}
                    chainBadgeName={chainBadgeName}
                    onPress={onPress}
                />
            )
        }
    }
}
