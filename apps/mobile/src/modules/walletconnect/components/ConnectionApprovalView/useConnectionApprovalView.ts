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

import { useCallback, useRef, useState } from 'react'
import type { ConnectionProposal } from '@perawallet/wallet-core-connections'
import { logger } from '@perawallet/wallet-core-shared'
import {
    trackEvent,
    WalletConnectEvent,
    AnalyticsMetadataKey,
} from '@analytics'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useQuantumDappWarning } from '@hooks/useQuantumDappWarning'

export type UseConnectionApprovalViewResult = {
    selectedAccounts: string[]
    isConnecting: boolean
    handleAccountPress: (address: string) => void
    handleConnect: () => Promise<void>
    handleCancel: () => Promise<void>
}

/**
 * Drives `ConnectionApprovalView` from a protocol-agnostic
 * `ConnectionProposal`: every action goes straight through
 * `proposal.approve` / `proposal.reject`, so the screen carries no
 * `useWalletConnect`, no v1/v2 branching and no registry lookup of its own.
 *
 * The sibling of the legacy, `WalletConnectSessionRequest`-driven
 * `ConnectionView`, which is what `useWalletConnectProvider` renders — still
 * the browser extension's approval screen. It ports the same three
 * approval-time behaviours: the quantum-dApp warning gate, session analytics,
 * and a retry-friendly delivery-failure toast.
 *
 * Showing the success sheet is deliberately NOT here: it belongs to whoever
 * outlives this sheet, and it reads the origin the handler wrote into the
 * record at approval. See `useProposalQueue`.
 */
export const useConnectionApprovalView = (
    proposal: ConnectionProposal,
): UseConnectionApprovalViewResult => {
    const { t } = useLanguage()
    const { errorToast } = useToast()
    const { confirmQuantumDappUsage } = useQuantumDappWarning()
    const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
    const [isConnecting, setIsConnecting] = useState(false)
    // Guards both handlers below against a double-tap reaching `proposal`
    // twice. Connect has an async gap BEFORE `isConnecting` flips true (the
    // quantum-warning sheet is awaited first — see `handleConnect`), so
    // `isLoading`/`isDisabled` alone can't close it; Cancel has no
    // state-driven disabling at all. A second `proposal.reject`/`approve`
    // call while the first is still in flight is exactly the shape that
    // reached `useConnectionsProvider`'s stale-settle bug — a single ref
    // shared by both handlers closes it at the source rather than relying on
    // the provider alone.
    const isHandlingRef = useRef(false)

    const handleAccountPress = useCallback((address: string) => {
        setSelectedAccounts(prev =>
            prev.includes(address)
                ? prev.filter(existing => existing !== address)
                : [...prev, address],
        )
    }, [])

    // Shared by the Cancel button and `handleConnect`'s quantum-cancel
    // branch — callers that already hold `isHandlingRef` (i.e.
    // `handleConnect`) call this directly rather than through `handleCancel`,
    // which would otherwise see the guard held and no-op.
    const rejectProposal = useCallback(
        async (reason?: string) => {
            trackEvent(WalletConnectEvent.SessionRejected, {
                [AnalyticsMetadataKey.DappName]: proposal.peer.name,
                [AnalyticsMetadataKey.DappUrl]: proposal.peer.url ?? '',
            })
            try {
                await proposal.reject(reason)
            } catch (error) {
                logger.error('Failed to reject a connection proposal', {
                    error,
                })
            }
        },
        [proposal],
    )

    const handleCancel = useCallback(async () => {
        if (isHandlingRef.current) return
        isHandlingRef.current = true
        try {
            await rejectProposal()
        } finally {
            isHandlingRef.current = false
        }
    }, [rejectProposal])

    const handleConnect = useCallback(async () => {
        if (isHandlingRef.current) return
        isHandlingRef.current = true
        try {
            // The peer's side of the handshake expires long before a queued
            // approval reaches this button — approving it here can only
            // fake-succeed. Decline instead of silently doing nothing, so
            // the proposal (and any sheet driven by it) still settles.
            // Checked before the quantum warning so an already-dead
            // proposal never bothers the user with it.
            if (Date.now() > proposal.expiresAt) {
                try {
                    await proposal.reject('expired')
                } catch (error) {
                    logger.error(
                        'Failed to reject an expired connection proposal',
                        { error },
                    )
                }
                return
            }

            // Before approve runs, so a 'cancel' can't leave a
            // half-approved connection behind. This await is the async gap
            // `isHandlingRef` exists to cover — `isConnecting` doesn't flip
            // true until after it.
            const decision = await confirmQuantumDappUsage(selectedAccounts)
            if (decision === 'cancel') {
                await rejectProposal()
                return
            }

            setIsConnecting(true)
            try {
                await proposal.approve(selectedAccounts)
                trackEvent(WalletConnectEvent.SessionApproved, {
                    [AnalyticsMetadataKey.DappName]: proposal.peer.name,
                    [AnalyticsMetadataKey.DappUrl]: proposal.peer.url ?? '',
                    [AnalyticsMetadataKey.AccountAddress]: selectedAccounts[0],
                    [AnalyticsMetadataKey.TotalAccount]:
                        selectedAccounts.length,
                })
            } catch (error) {
                // Delivery failure (dead socket that couldn't be revived,
                // etc.): keep the sheet open so Connect can simply be
                // retried, exactly like `ConnectionView` — this
                // deliberately does not reject the proposal.
                logger.error('Failed to approve a connection proposal', {
                    error,
                })
                errorToast(
                    t('walletconnect.request.error_sheet_title'),
                    t('walletconnect.connection.approve_delivery_failed'),
                )
            } finally {
                setIsConnecting(false)
            }
        } finally {
            isHandlingRef.current = false
        }
    }, [
        proposal,
        selectedAccounts,
        confirmQuantumDappUsage,
        rejectProposal,
        errorToast,
        t,
    ])

    return {
        selectedAccounts,
        isConnecting,
        handleAccountPress,
        handleConnect,
        handleCancel,
    }
}
