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

import { useCallback, useMemo } from 'react'
import { useAccountValueBasis } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    chainDisplayNameOf,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import {
    type InboxItem,
    useCleanupDuplicateMultisigInvitations,
    useInboxQuery,
} from '@perawallet/wallet-core-messages'
import { useIsDeviceRegistrationPending } from '@perawallet/wallet-core-device'
import {
    isIntegrityRequiredError,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { ALGORAND_CHAIN_ID } from '@modules/algorand/chain-id'
import {
    useHandleInboxItemPress,
    useTokenInboxes,
} from '@modules/messages/hooks'
import { useNetworkStatus } from '@modules/network'

/** An inbox row with the scope its item belongs to. */
export type InboxEntry = {
    item: InboxItem
    scope: ChainScope
    /** Set when the row names its chain: a token inbox always does, the backend's once the wallet spans chains. */
    chainBadgeName: Optional<string>
}

export type UseInboxScreenResult = {
    inboxEntries: InboxEntry[]
    isPending: boolean
    isRefetching: boolean
    isError: boolean
    isOffline: boolean
    isIntegrityBlocked: boolean
    isAwaitingRegistration: boolean
    isUnavailableOnNetwork: boolean
    refetch: () => void
    keyExtractor: (entry: InboxEntry, index: number) => string
    handleInboxItemPress: (entry: InboxEntry) => void
}

const getItemKey = ({ item, scope }: InboxEntry, index: number): string => {
    switch (item.type) {
        case 'multisig_import': {
            return `import-${item.data.customId}-${item.data.address}`
        }
        case 'multisig_sign': {
            return `sign-${item.data.id}`
        }
        case 'asa_inbox': {
            return `asa-${scope.chainId}-${scope.networkId}-${item.data.address}-${index}`
        }
    }
}

export const useInboxScreen = (): UseInboxScreenResult => {
    const scope = useSelectedScope(ALGORAND_CHAIN_ID)
    const {
        data: inboxItems,
        isPending,
        isPaused,
        isError,
        error,
        isRefetching,
        refetch,
        isUnavailableOnNetwork,
    } = useInboxQuery(scope)
    useCleanupDuplicateMultisigInvitations(scope)
    const handleInboxItemPress = useHandleInboxItemPress(scope)
    const isRegistrationPending = useIsDeviceRegistrationPending()
    const { hasInternet } = useNetworkStatus()
    const isMultiChain = useAccountValueBasis(scope.chainId) === 'fiat'
    const tokenInboxes = useTokenInboxes()
    const handleEntryPress = useCallback(
        (entry: InboxEntry) => handleInboxItemPress(entry.item, entry.scope),
        [handleInboxItemPress],
    )

    const inboxEntries = useMemo<InboxEntry[]>(
        () => [
            ...(inboxItems ?? []).map(item => ({
                item,
                scope,
                chainBadgeName: isMultiChain
                    ? chainDisplayNameOf(scope.chainId)
                    : undefined,
            })),
            ...tokenInboxes.map(({ item, scope: tokenScope }) => ({
                item,
                scope: tokenScope,
                chainBadgeName: chainDisplayNameOf(tokenScope.chainId),
            })),
        ],
        [inboxItems, tokenInboxes, scope, isMultiChain],
    )

    // Offline wins over a stale error: a paused, uncached fetch means there is
    // nothing to show yet, and an error surfacing while genuinely offline is
    // the same "nothing to show" situation — not a dead Retry. Mirrors the
    // charts / staking contract (docs/OFFLINE_PAUSED_STATE.md).
    const isOffline = isPaused || (isError && !hasInternet)
    const isIntegrityBlocked = isError && isIntegrityRequiredError(error)
    // Registration can never complete on a network with no Pera backend, so
    // don't let that state masquerade as "still awaiting registration".
    const isAwaitingRegistration =
        !isUnavailableOnNetwork &&
        isRegistrationPending &&
        inboxEntries.length === 0

    return {
        inboxEntries,
        isPending,
        isRefetching,
        isError,
        isOffline,
        isIntegrityBlocked,
        isAwaitingRegistration,
        isUnavailableOnNetwork,
        refetch: () => void refetch(),
        keyExtractor: getItemKey,
        handleInboxItemPress: handleEntryPress,
    }
}
