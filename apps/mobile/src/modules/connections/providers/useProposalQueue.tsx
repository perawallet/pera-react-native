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
    useCallback,
    useEffect,
    useMemo,
    useRef,
    type ReactElement,
} from 'react'
import {
    createProposalQueue,
    type ConnectionErrorScope,
    type ConnectionRegistry,
    type ProposalQueue,
    type ProposalQueueSheet,
} from '@perawallet/wallet-core-connections'
import { generateUniqueId, type Nullable } from '@perawallet/wallet-core-shared'
import { useBottomSheet, type BottomSheetOptions } from '@modules/bottom-sheet'
import { ConnectionApprovalView } from '@modules/walletconnect/components/ConnectionApprovalView'
import { ConnectionApprovalSuccessView } from '@modules/walletconnect/components/ConnectionApprovalSuccessView'

export type ProposalQueueHandle = Pick<
    ProposalQueue,
    'closeForScope' | 'isRejectingOnError'
>

/** Renders the registry's proposals through `createProposalQueue`, one sheet at a time. */
export const useProposalQueue = (
    registry: ConnectionRegistry,
): ProposalQueueHandle => {
    const { request: requestBottomSheet, dismiss } = useBottomSheet()
    const queueRef = useRef<Nullable<ProposalQueue>>(null)

    useEffect(() => {
        const sheet = (
            contents: ReactElement,
            options: BottomSheetOptions,
        ): ProposalQueueSheet => {
            const id = generateUniqueId()
            return {
                close: () => dismiss(id),
                closed: requestBottomSheet({ id, contents, options }).then(
                    () => undefined,
                ),
            }
        }
        const queue = createProposalQueue({
            openApproval: proposal =>
                sheet(<ConnectionApprovalView proposal={proposal} />, {
                    size: 'modal',
                    enableCloseOnBackdropPress: false,
                    autoCreateContainer: false,
                }),
            // In-app pairings skip the sheet: the dApp is right behind the
            // sheet host and shows its own connected state.
            openSuccess: connection =>
                connection.origin?.source === 'in-app'
                    ? null
                    : sheet(
                          <ConnectionApprovalSuccessView
                              connection={connection}
                          />,
                          { size: 'auto', enablePanDownToClose: true },
                      ),
        })
        queueRef.current = queue
        const unsubscribe = registry.subscribeToProposals(queue.enqueue)
        return () => {
            unsubscribe()
            queue.teardown()
            queueRef.current = null
        }
    }, [registry, requestBottomSheet, dismiss])

    const closeForScope = useCallback((scope: ConnectionErrorScope) => {
        queueRef.current?.closeForScope(scope)
    }, [])

    const isRejectingOnError = useCallback(
        (scope: ConnectionErrorScope) =>
            queueRef.current?.isRejectingOnError(scope) ?? false,
        [],
    )

    return useMemo(
        () => ({ closeForScope, isRejectingOnError }),
        [closeForScope, isRejectingOnError],
    )
}
