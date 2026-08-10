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

import { useCallback } from 'react'
import type { ASAInbox, InboxItem } from '@perawallet/wallet-core-messages'
import type { MultiSigAccount } from '@perawallet/wallet-core-multisig'
import { pushScreen } from '@hooks/deeplink/navigateToScreen'
import { useToast } from '@hooks/useToast'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useHandleMultisigSignTap } from '@modules/multisig/hooks/useHandleMultisigSignTap'
import {
    MultisigInvitationDetailContent,
    type MultisigInvitationDetailContentResult,
} from '@modules/messages/components/MultisigInvitationDetailContent'
import type { MultisigInvitationParam } from '../routes/types'

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

export type UseHandleInboxItemPressResult = (item: InboxItem) => void

/**
 * Returns the canonical handler for acting on an inbox item. This is the
 * single source of truth for "what happens when you open an inbox message":
 * the inbox list calls it on tap, and `useNotificationPress` calls it after
 * resolving a multisig notification to its matching inbox item — so both
 * entry points share one code path instead of routing through a store.
 */
// Navigation goes through `pushScreen` (the global navigationRef) rather than
// `useAppNavigation`: `useNotificationDeeplinkListener` reaches this hook from
// RootComponent, which sits above NavigationContainer, so `useNavigation` has
// no context there and throws during render on every launch.
export const useHandleInboxItemPress = (): UseHandleInboxItemPressResult => {
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
                        options: {
                            size: 'modal',
                            enablePanDownToClose: true,
                            autoCreateContainer: false,
                        },
                    },
                )

            if (result === 'accept') {
                pushScreen('Messages', {
                    screen: 'MultisigInvitationName',
                    params: { invitation },
                })
            }
        },
        [requestBottomSheet],
    )

    return useCallback(
        (item: InboxItem) => {
            switch (item.type) {
                case 'asa_inbox': {
                    const asaInbox = item.data as ASAInbox
                    pushScreen('Messages', {
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
                default: {
                    errorToast(
                        'common.not_implemented.title',
                        'common.not_implemented.body',
                    )
                }
            }
        },
        [errorToast, handleMultisigSignTap, openInvitationDetail],
    )
}
