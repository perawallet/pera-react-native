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
    type InboxItem,
    useCleanupDuplicateMultisigInvitations,
    useInboxQuery,
} from '@perawallet/wallet-core-messages'
import { useIsDeviceRegistrationPending } from '@perawallet/wallet-core-device'
import { useHandleInboxItemPress } from '@modules/messages/hooks'

export type UseInboxScreenResult = {
    inboxItems: InboxItem[]
    isPending: boolean
    isRefetching: boolean
    isAwaitingRegistration: boolean
    isUnavailableOnNetwork: boolean
    refetch: () => void
    keyExtractor: (item: InboxItem, index: number) => string
    handleInboxItemPress: (item: InboxItem) => void
}

const getItemKey = (item: InboxItem, index: number): string => {
    switch (item.type) {
        case 'multisig_import': {
            return `import-${item.data.customId}-${item.data.address}`
        }
        case 'multisig_sign': {
            return `sign-${item.data.id}`
        }
        case 'asa_inbox': {
            return `asa-${item.data.address}-${index}`
        }
    }
}

export const useInboxScreen = (): UseInboxScreenResult => {
    const {
        data: inboxItems,
        isPending,
        isRefetching,
        refetch,
        isUnavailableOnNetwork,
    } = useInboxQuery()
    useCleanupDuplicateMultisigInvitations()
    const handleInboxItemPress = useHandleInboxItemPress()
    const isRegistrationPending = useIsDeviceRegistrationPending()
    // Registration can never complete on a network with no Pera backend, so
    // don't let that state masquerade as "still awaiting registration".
    const isAwaitingRegistration =
        !isUnavailableOnNetwork &&
        isRegistrationPending &&
        (inboxItems?.length ?? 0) === 0

    return {
        inboxItems: inboxItems ?? [],
        isPending,
        isRefetching,
        isAwaitingRegistration,
        isUnavailableOnNetwork,
        refetch: () => void refetch(),
        keyExtractor: getItemKey,
        handleInboxItemPress,
    }
}
