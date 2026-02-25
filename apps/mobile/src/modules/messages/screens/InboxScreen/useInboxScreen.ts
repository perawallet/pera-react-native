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

import { useCallback } from 'react'
import {
    type ASAInbox,
    type InboxItem,
    useInboxQuery,
} from '@perawallet/wallet-core-messages'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'

export type UseInboxScreenResult = {
    inboxItems: InboxItem[]
    isPending: boolean
    isRefetching: boolean
    refetch: () => void
    keyExtractor: (item: InboxItem, index: number) => string
    handleInboxItemPress: (item: InboxItem) => void
}

const getItemKey = (item: InboxItem, index: number): string => {
    switch (item.type) {
        case 'joint_account_import':
            return `import-${item.data.customId}-${item.data.address}`
        case 'joint_account_sign':
            return `sign-${item.data.id}`
        case 'asa_inbox':
            return `asa-${item.data.address}-${index}`
    }
}

export const useInboxScreen = (): UseInboxScreenResult => {
    const { data: inboxItems, isPending, isRefetching, refetch } = useInboxQuery()
    const { push } = useAppNavigation()
    const { errorToast } = useToast()

    const handleInboxItemPress = useCallback((item: InboxItem) => {
        if (item.type === 'asa_inbox') {
            const asaInbox = item.data as ASAInbox
            push('Messages', {
                screen: 'AssetTransferRequests',
                params: { item: asaInbox },
            })
        } else {
            errorToast(
                'common.not_implemented.title',
                'common.not_implemented.body',
            )
        }
    }, [])

    return {
        inboxItems: inboxItems ?? [],
        isPending,
        isRefetching,
        refetch,
        keyExtractor: getItemKey,
        handleInboxItemPress,
    }
}
