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

import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import type {
    Connection,
    ConnectionId,
} from '@perawallet/wallet-extension-connections'
import {
    matchesScope,
    type ConnectionErrorScope,
    type ConnectionProposal,
} from './models'

/** A piece of UI the queue put on screen. */
export type ProposalQueueSheet = {
    /** Dismisses the UI; may be called after it has already gone. */
    close: () => void
    /** Settles once the UI is gone; rejects when it never showed at all. */
    closed: Promise<void>
}

export type ProposalQueueUi = {
    /**
     * Shows the approval UI for `proposal`, whose `approve`/`reject` are the
     * queue's wrappers and must be the ones the UI calls.
     */
    openApproval: (proposal: ConnectionProposal) => ProposalQueueSheet
    /** `null` shows nothing, and the queue moves on at once. */
    openSuccess: (connection: Connection) => Nullable<ProposalQueueSheet>
}

export type ProposalQueue = {
    enqueue: (proposal: ConnectionProposal) => void
    /** Dismisses and rejects whatever is open or queued for the error's subject. */
    closeForScope: (scope: ConnectionErrorScope) => void
    /** Whether a rejection issued by `closeForScope` is still being delivered. */
    isRejectingOnError: (scope: ConnectionErrorScope) => boolean
    /** Rejects everything outstanding so every peer hears back. */
    teardown: () => void
}

/** What the sheet on screen answers to; the approval sheet knows only a pairing. */
type OpenSheet = {
    pairingId?: string
    connectionId?: ConnectionId
    /** Dismisses the UI only, for a caller that answers the peer itself. */
    dismiss: () => void
    /**
     * Dismisses the UI and answers the peer; the connection-error path.
     * Absent on a sheet no scope can name, which nothing can reach it through.
     */
    close?: () => void
}

const logRejectFailure =
    (message: string, proposalId?: string) =>
    (error: unknown): void => {
        logger.error(message, { error, proposalId })
    }

/**
 * One approval on screen at a time for the registry's proposals.
 * `subscribeToProposals` is an unbuffered fan-out, so a second proposal
 * arriving mid-approval waits here rather than being dropped; buffering is a
 * presentation concern, which is why the registry stays unbuffered.
 */
export const createProposalQueue = (ui: ProposalQueueUi): ProposalQueue => {
    let pending: ConnectionProposal[] = []
    let open: Nullable<ConnectionProposal> = null
    let openSheet: Nullable<OpenSheet> = null
    // The success sheet holds the next proposal back so a second dApp's
    // approval never opens over the first's "connected!".
    let isHolding = false
    // The rejection's own delivery failure comes back through the same error
    // channel — the socket that failed is the one being answered.
    const rejectingOnError = new Set<string>()

    const advance = (): void => {
        const next = pending.shift()
        if (next) show(next)
    }

    const hold = (connection: Connection): void => {
        const success = ui.openSuccess(connection)
        if (!success) {
            advance()
            return
        }
        isHolding = true
        // The pairing is a session now, so an error about it arrives scoped
        // to the CONNECTION. Nothing to reject: it is approved.
        openSheet = {
            connectionId: connection.id,
            close: success.close,
            dismiss: success.close,
        }
        void success.closed
            .catch((error: unknown) => {
                // The session is already approved; this only costs the
                // confirmation.
                logger.error('Failed to show the connection success sheet', {
                    error,
                })
            })
            .finally(() => {
                if (openSheet?.connectionId === connection.id) openSheet = null
                isHolding = false
                advance()
            })
    }

    const show = (proposal: ConnectionProposal): void => {
        // The peer's handshake expires long before a queued approval reaches
        // the screen; approving it could only fake-succeed.
        if (Date.now() > proposal.expiresAt) {
            void proposal
                .reject('expired')
                .catch(
                    logRejectFailure(
                        'Failed to reject an expired connection proposal',
                    ),
                )
            advance()
            return
        }

        open = proposal
        let sheet: Nullable<ProposalQueueSheet> = null

        const settle = (
            shouldDismiss: boolean,
            connection?: Connection,
        ): void => {
            // A double-tapped Cancel settles twice; the stale call must not
            // dismiss a since-opened queued proposal.
            if (open?.proposalId !== proposal.proposalId) return
            open = null
            openSheet = null
            if (shouldDismiss) sheet?.close()
            if (connection) hold(connection)
            else advance()
        }

        const { pairingId } = proposal
        const dismiss = (): void => sheet?.close()
        openSheet = pairingId
            ? {
                  pairingId,
                  dismiss,
                  // Dismisses synchronously — the sheet must not sit over a
                  // dead connection for a delivery round-trip — then the raw
                  // `reject` (the wrapper would settle twice) tears the
                  // pairing down in the background.
                  close: () => {
                      settle(true)
                      rejectingOnError.add(pairingId)
                      void proposal
                          .reject('connection error')
                          .catch(
                              logRejectFailure(
                                  'Failed to reject a connection proposal after a connection error',
                              ),
                          )
                          .finally(() => {
                              rejectingOnError.delete(pairingId)
                          })
                  },
              }
            : // Scope-less, so `closeForScope` never matches it; carried only
              // so `teardown` can take the sheet off screen.
              { dismiss }

        const settled: ConnectionProposal = {
            ...proposal,
            // Only a successful approve settles: a delivery failure leaves the
            // sheet open so Connect can be retried. Reject always settles.
            approve: accounts =>
                proposal.approve(accounts).then(connection => {
                    settle(true, connection)
                    return connection
                }),
            // Dismissed before the answer goes out, as the connection-error
            // path above is: `reject` waits on a socket revival, and the sheet
            // must not sit frozen over a dead connection for that round-trip.
            // The promise still carries a delivery failure to the caller.
            reject: reason => {
                settle(true)
                return proposal.reject(reason)
            },
        }

        sheet = ui.openApproval(settled)
        // Both branches release the guard: the sheet host resolves `closed`
        // when it dismisses without a decision (a store reset, an unregistered
        // host), and leaving `open` set there would queue every later proposal
        // behind a sheet that is no longer on screen. `settle` is idempotent,
        // so the ordinary approve/reject path is a no-op here.
        void sheet.closed.then(
            () => {
                // Still undecided means the sheet went away under the user;
                // it cannot come back, so the peer is answered rather than
                // left to time out.
                const isUndecided = open?.proposalId === proposal.proposalId
                settle(false)
                if (isUndecided) {
                    void proposal
                        .reject('dismissed')
                        .catch(
                            logRejectFailure(
                                'Failed to reject a connection proposal dismissed without a decision',
                                proposal.proposalId,
                            ),
                        )
                }
            },
            (error: unknown) => {
                // Nothing was shown, so release the guard without dismissing.
                logger.error('Failed to show a connection proposal sheet', {
                    error,
                })
                settle(false)
            },
        )
    }

    return {
        enqueue: proposal => {
            if (open || isHolding) {
                pending.push(proposal)
                return
            }
            show(proposal)
        },
        closeForScope: scope => {
            // A queued proposal for the subject would open onto a pairing that
            // is already gone, and its connector stays bound for the request
            // TTL, so it is answered here rather than merely dropped.
            const dropped: ConnectionProposal[] = []
            pending = pending.filter(queued => {
                if (!matchesScope({ pairingId: queued.pairingId }, scope)) {
                    return true
                }
                dropped.push(queued)
                return false
            })
            for (const queued of dropped) {
                void queued
                    .reject('connection error')
                    .catch(
                        logRejectFailure(
                            'Failed to reject a queued connection proposal after a connection error',
                            queued.proposalId,
                        ),
                    )
            }
            const sheet = openSheet
            if (sheet && matchesScope(sheet, scope)) sheet.close?.()
        },
        isRejectingOnError: scope =>
            (scope.pairingId !== undefined &&
                rejectingOnError.has(scope.pairingId)) ||
            (scope.connectionId !== undefined &&
                rejectingOnError.has(scope.connectionId)),
        teardown: () => {
            const outstanding = [...(open ? [open] : []), ...pending]
            // Taken off screen first: the rejections below leave nothing for a
            // sheet still sitting over the pairing to answer.
            openSheet?.dismiss()
            open = null
            openSheet = null
            isHolding = false
            pending = []
            for (const proposal of outstanding) {
                void proposal
                    .reject('provider torn down')
                    .catch(
                        logRejectFailure(
                            'Failed to reject an outstanding connection proposal during teardown',
                            proposal.proposalId,
                        ),
                    )
            }
        },
    }
}
