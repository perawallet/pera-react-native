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

import type { InboxItem } from '@perawallet/wallet-core-messages'

export const isPendingAction = (item: InboxItem): boolean => {
    switch (item.type) {
        case 'multisig_import': {
            return true
        }
        case 'multisig_sign': {
            return (
                item.data.status === 'pending' || item.data.status === 'ready'
            )
        }
        case 'asa_inbox': {
            return item.data.requestCount > 0
        }
    }
}
