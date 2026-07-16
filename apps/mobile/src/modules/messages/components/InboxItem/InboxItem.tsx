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
import { AsaInboxItem } from './AsaInboxItem'
import { MultisigInvitationInboxItem } from './MultisigInvitationInboxItem'
import { MultisigSignInboxItem } from './MultisigSignInboxItem'

export type InboxItemProps = {
    item: InboxItemModel
    onPress?: () => void
}

export const InboxItem = ({ item, onPress }: InboxItemProps) => {
    switch (item.type) {
        case 'asa_inbox': {
            return (
                <AsaInboxItem
                    item={item}
                    onPress={onPress}
                />
            )
        }
        case 'multisig_sign': {
            return (
                <MultisigSignInboxItem
                    item={item}
                    onPress={onPress}
                />
            )
        }
        case 'multisig_import': {
            return (
                <MultisigInvitationInboxItem
                    item={item}
                    onPress={onPress}
                />
            )
        }
    }
}
