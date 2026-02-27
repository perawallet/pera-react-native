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
    type InboxItem,
    useInboxQuery,
} from '@perawallet/wallet-core-notifications'

export type UseInboxScreenResult = {
    inboxItems: InboxItem[]
    isPending: boolean
    isRefetching: boolean
    refetch: () => void
    keyExtractor: (item: InboxItem) => string
}

const getItemKey = (item: InboxItem): string => {
    switch (item.type) {
        case 'joint_account_import':
            return `import-${item.data.customId}-${item.data.address}`
        case 'joint_account_sign':
            return `sign-${item.data.id}`
        case 'asa_inbox':
            return `asa-${item.data.address}`
    }
}

export const useInboxScreen = (): UseInboxScreenResult => {
    const { inboxItems, isPending, isRefetching, refetch } = useInboxQuery()

    return {
        inboxItems,
        isPending,
        isRefetching,
        refetch,
        keyExtractor: getItemKey,
    }
}
