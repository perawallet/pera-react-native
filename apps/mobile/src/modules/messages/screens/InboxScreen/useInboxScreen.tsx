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

import { useCallback, useEffect } from 'react'
import {
    type ASAInbox,
    type InboxItem,
    useCleanupDuplicateMultisigInvitations,
    useInboxQuery,
} from '@perawallet/wallet-core-messages'
import type { MultiSigAccount } from '@perawallet/wallet-core-multisig'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useHandleMultisigSignTap } from '@modules/multisig/hooks/useHandleMultisigSignTap'
import { useMultisigNotificationIntentStore } from '@modules/multisig/stores/useMultisigNotificationIntentStore'
import {
    MultisigInvitationDetailContent,
    type MultisigInvitationDetailContentResult,
} from '@modules/messages/components/MultisigInvitationDetailContent'
import type { MultisigInvitationParam } from '../../routes/types'

const toInvitationParam = (
    invitation: MultiSigAccount,
): MultisigInvitationParam => ({
    customId: invitation.customId,
    createdAt: invitation.createdAt.toISOString(),
    address: invitation.address,
    version: invitation.version,
    threshold: invitation.threshold,
    participantAddresses: invitation.participantAddresses,
})

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
        case 'multisig_import':
            return `import-${item.data.customId}-${item.data.address}`
        case 'multisig_sign':
            return `sign-${item.data.id}`
        case 'asa_inbox':
            return `asa-${item.data.address}-${index}`
    }
}

export const useInboxScreen = (): UseInboxScreenResult => {
    const {
        data: inboxItems,
        isPending,
        isRefetching,
        refetch,
    } = useInboxQuery()
    useCleanupDuplicateMultisigInvitations()
    const { push } = useAppNavigation()
    const { errorToast } = useToast()
    const handleMultisigSignTap = useHandleMultisigSignTap()
    const { request: requestBottomSheet } = useBottomSheet()

    const openInvitationDetail = useCallback(
        async (invitation: MultisigInvitationParam) => {
            const result =
                await requestBottomSheet<MultisigInvitationDetailContentResult>(
                    {
                        contents: (
                            <MultisigInvitationDetailContent
                                invitation={invitation}
                            />
                        ),
                        options: { size: 'auto', enablePanDownToClose: true },
                    },
                )

            if (result === 'accept') {
                push('Messages', {
                    screen: 'MultisigInvitationName',
                    params: { invitation },
                })
            }
        },
        [requestBottomSheet, push],
    )

    const handleInboxItemPress = useCallback(
        (item: InboxItem) => {
            switch (item.type) {
                case 'asa_inbox': {
                    const asaInbox = item.data as ASAInbox
                    push('Messages', {
                        screen: 'AssetTransferRequests',
                        params: { item: asaInbox },
                    })
                    return
                }
                case 'multisig_import': {
                    void openInvitationDetail(toInvitationParam(item.data))
                    return
                }
                case 'multisig_sign': {
                    handleMultisigSignTap(item.data)
                    return
                }
                default:
                    errorToast(
                        'common.not_implemented.title',
                        'common.not_implemented.body',
                    )
            }
        },
        [push, errorToast, handleMultisigSignTap, openInvitationDetail],
    )

    const pendingIntent = useMultisigNotificationIntentStore(
        state => state.pendingIntent,
    )
    const consumeIntent = useMultisigNotificationIntentStore(
        state => state.consumeIntent,
    )

    useEffect(() => {
        if (!pendingIntent || isPending) return
        const matches = (inboxItems ?? []).filter(item => {
            if (
                pendingIntent.kind === 'sign' &&
                item.type === 'multisig_sign'
            ) {
                return (
                    item.data.multisigAccount.address === pendingIntent.address
                )
            }
            if (
                pendingIntent.kind === 'import' &&
                item.type === 'multisig_import'
            ) {
                return item.data.address === pendingIntent.address
            }
            return false
        })
        if (matches.length === 1) {
            handleInboxItemPress(matches[0])
        }
        consumeIntent()
    }, [
        pendingIntent,
        isPending,
        inboxItems,
        handleInboxItemPress,
        consumeIntent,
    ])

    return {
        inboxItems: inboxItems ?? [],
        isPending,
        isRefetching,
        refetch,
        keyExtractor: getItemKey,
        handleInboxItemPress,
    }
}
