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

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type {
    ConnectionErrorScope,
    ConnectionProposal,
    ConnectionRegistry,
} from '@perawallet/wallet-core-connections'
import {
    generateUniqueId,
    logger,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type {
    Connection,
    ConnectionId,
} from '@perawallet/wallet-extension-connections'
import { useBottomSheet } from '@modules/bottom-sheet'
import { ConnectionApprovalView } from '@modules/walletconnect/components/ConnectionApprovalView'
import { ConnectionApprovalSuccessView } from '@modules/walletconnect/components/ConnectionApprovalSuccessView'

export type ProposalQueueHandle = {
    /** Dismisses and rejects whatever is open or queued for the error's subject. */
    closeForScope: (scope: ConnectionErrorScope) => void
    /** Whether a rejection issued by `closeForScope` is still being delivered. */
    isRejectingOnError: (scope: ConnectionErrorScope) => boolean
}

/** What a sheet on screen answers to; the approval sheet knows only a pairing. */
type SheetSubject = { pairingId?: string; connectionId?: ConnectionId }

type OpenSheet = SheetSubject & { close: () => void }

// Matched field by field, never one id against the other: a pairing and the
// connection it becomes share an id on WalletConnect v1 only.
const matchesScope = (
    subject: SheetSubject,
    scope: ConnectionErrorScope,
): boolean =>
    (scope.pairingId !== undefined && scope.pairingId === subject.pairingId) ||
    (scope.connectionId !== undefined &&
        scope.connectionId === subject.connectionId)

/**
 * Shows one `ConnectionApprovalView` at a time for the registry's proposals.
 * `subscribeToProposals` is an unbuffered fan-out, so a second proposal
 * arriving mid-approval is queued here rather than dropped; buffering is a
 * presentation concern, which is why the registry stays unbuffered.
 */
export const useProposalQueue = (
    registry: ConnectionRegistry,
): ProposalQueueHandle => {
    const { request: requestBottomSheet, dismiss } = useBottomSheet()
    const openProposalIdRef = useRef<Nullable<string>>(null)
    // Kept only so teardown can reject the proposal on screen.
    const openProposalRef = useRef<ConnectionProposal | null>(null)
    const sheetIdRef = useRef<Nullable<string>>(null)
    const proposalQueueRef = useRef<ConnectionProposal[]>([])
    const openSheetRef = useRef<Nullable<OpenSheet>>(null)
    // The rejection's own delivery failure comes back through the same error
    // channel — the socket that failed is the one being answered. Holds every
    // id the failing subject is known by, so either scope suppresses it.
    const rejectingOnErrorRef = useRef<Set<string>>(new Set())

    useEffect(() => {
        const showConnectionSuccess = (
            connection: Connection,
        ): Promise<void> => {
            // In-app pairings skip the sheet: the dApp is right behind the
            // sheet host and shows its own connected state.
            if (connection.origin?.source === 'in-app') return Promise.resolve()
            const id = generateUniqueId()
            const shown = requestBottomSheet<void>({
                id,
                contents: (
                    <ConnectionApprovalSuccessView connection={connection} />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            })
                .then(() => undefined)
                .catch((error: unknown) => {
                    // The session is already approved; this only costs the
                    // confirmation, so let the queue move on.
                    logger.error(
                        'Failed to show the connection success sheet',
                        { error },
                    )
                })
            // The pairing is a session now, so an error about it arrives
            // scoped to the CONNECTION — and "connected!" must not sit over a
            // session that has just died. Nothing to reject: it is approved.
            openSheetRef.current = {
                connectionId: connection.id,
                close: () => dismiss(id),
            }
            void shown.finally(() => {
                if (openSheetRef.current?.connectionId === connection.id) {
                    openSheetRef.current = null
                }
            })
            return shown
        }

        const openProposal = (proposal: ConnectionProposal): void => {
            // The peer's handshake expires long before a queued approval
            // reaches the screen; approving it could only fake-succeed.
            if (Date.now() > proposal.expiresAt) {
                void proposal.reject('expired').catch((error: unknown) => {
                    logger.error(
                        'Failed to reject an expired connection proposal',
                        { error },
                    )
                })
                const next = proposalQueueRef.current.shift()
                if (next) openProposal(next)
                return
            }

            openProposalIdRef.current = proposal.proposalId
            openProposalRef.current = proposal
            const { pairingId } = proposal
            openSheetRef.current = pairingId
                ? {
                      pairingId,
                      // Dismisses synchronously — the sheet must not sit over
                      // a dead connection for a delivery round-trip — then
                      // the raw `reject` (not the wrapped one, which would
                      // settle twice) tears the pairing down in the background.
                      close: () => {
                          settle(true)
                          rejectingOnErrorRef.current.add(pairingId)
                          void proposal
                              .reject('connection error')
                              .catch((error: unknown) => {
                                  logger.error(
                                      'Failed to reject a connection proposal after a connection error',
                                      { error },
                                  )
                              })
                              .finally(() => {
                                  rejectingOnErrorRef.current.delete(pairingId)
                              })
                      },
                  }
                : null

            // `shouldDismiss` is false only when `requestBottomSheet` never
            // showed anything. `startHold` (the success sheet) keeps the next
            // proposal queued until it settles, so a second dApp's approval
            // never opens over the first's "connected!" sheet. It runs AFTER
            // this sheet's entry is cleared, so the sheet it opens can claim
            // the entry for itself.
            const settle = (
                shouldDismiss: boolean,
                startHold?: () => Promise<void>,
            ): void => {
                // Checked first: a double-tapped Cancel settles twice, and the
                // stale call must not dismiss a since-opened queued proposal.
                if (openProposalIdRef.current !== proposal.proposalId) return
                // A sentinel rather than null while the hold runs keeps an
                // inbound proposal queued instead of opening over the sheet.
                openProposalIdRef.current = startHold
                    ? generateUniqueId()
                    : null
                openProposalRef.current = null
                openSheetRef.current = null
                const id = sheetIdRef.current
                sheetIdRef.current = null
                if (shouldDismiss && id) dismiss(id)

                const advance = (): void => {
                    openProposalIdRef.current = null
                    const next = proposalQueueRef.current.shift()
                    if (next) openProposal(next)
                }
                if (!startHold) {
                    advance()
                    return
                }
                void startHold().finally(advance)
            }

            const settledProposal: ConnectionProposal = {
                ...proposal,
                // Only a successful approve settles: a delivery failure
                // leaves the sheet open so Connect can be retried. Reject
                // always settles, even when the peer cannot be reached.
                approve: accounts =>
                    proposal.approve(accounts).then(connection => {
                        settle(true, () => showConnectionSuccess(connection))
                        return connection
                    }),
                reject: reason =>
                    proposal.reject(reason).finally(() => settle(true)),
            }

            const id = generateUniqueId()
            sheetIdRef.current = id
            void requestBottomSheet({
                id,
                contents: <ConnectionApprovalView proposal={settledProposal} />,
                options: {
                    size: 'modal',
                    enableCloseOnBackdropPress: false,
                    autoCreateContainer: false,
                },
            }).catch((error: unknown) => {
                // No sheet host mounted: nothing was shown, so release the
                // guard without dismissing and try the next proposal.
                logger.error('Failed to show a connection proposal sheet', {
                    error,
                })
                settle(false)
            })
        }

        const unsubscribe = registry.subscribeToProposals(proposal => {
            if (openProposalIdRef.current) {
                proposalQueueRef.current.push(proposal)
                return
            }
            openProposal(proposal)
        })

        return () => {
            unsubscribe()
            // Reject everything outstanding so every peer hears back instead
            // of waiting out its own proposal TTL.
            const outstanding = [
                ...(openProposalRef.current ? [openProposalRef.current] : []),
                ...proposalQueueRef.current,
            ]
            openProposalIdRef.current = null
            openProposalRef.current = null
            openSheetRef.current = null
            sheetIdRef.current = null
            proposalQueueRef.current = []
            for (const proposal of outstanding) {
                proposal
                    .reject('provider torn down')
                    .catch((error: unknown) => {
                        logger.error(
                            'Failed to reject an outstanding connection proposal during teardown',
                            { error, proposalId: proposal.proposalId },
                        )
                    })
            }
        }
    }, [registry, requestBottomSheet, dismiss])

    // Queued proposals for the subject go too: they would open onto a socket
    // that is already gone.
    const closeForScope = useCallback((scope: ConnectionErrorScope) => {
        proposalQueueRef.current = proposalQueueRef.current.filter(
            queued => !matchesScope({ pairingId: queued.pairingId }, scope),
        )
        const open = openSheetRef.current
        if (open && matchesScope(open, scope)) open.close()
    }, [])

    const isRejectingOnError = useCallback(
        (scope: ConnectionErrorScope) =>
            (scope.pairingId !== undefined &&
                rejectingOnErrorRef.current.has(scope.pairingId)) ||
            (scope.connectionId !== undefined &&
                rejectingOnErrorRef.current.has(scope.connectionId)),
        [],
    )

    return useMemo(
        () => ({ closeForScope, isRejectingOnError }),
        [closeForScope, isRejectingOnError],
    )
}
