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

// Every action goes straight through `proposal.approve` / `proposal.reject`, so
// the screen carries no protocol branching. The success sheet is deliberately
// NOT shown here: it belongs to whoever outlives this sheet (see `useProposalQueue`).
export const useConnectionApprovalView = (
    proposal: ConnectionProposal,
): UseConnectionApprovalViewResult => {
    const { t } = useLanguage()
    const { errorToast } = useToast()
    const { confirmQuantumDappUsage } = useQuantumDappWarning()
    const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
    const [isConnecting, setIsConnecting] = useState(false)
    // Guards both handlers against a double-tap reaching `proposal` twice:
    // Connect has an async gap before `isConnecting` flips (the quantum-warning
    // await) and Cancel has no state-driven disabling at all.
    const isHandlingRef = useRef(false)

    const handleAccountPress = useCallback((address: string) => {
        setSelectedAccounts(prev =>
            prev.includes(address)
                ? prev.filter(existing => existing !== address)
                : [...prev, address],
        )
    }, [])

    // Callers already holding `isHandlingRef` (`handleConnect`) call this
    // directly; `handleCancel` would see the guard held and no-op.
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
            // The peer's side of the handshake expires long before a queued approval
            // reaches this button, so approving can only fake-succeed; decline so the
            // proposal still settles. Before the quantum warning: a dead proposal never shows it.
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

            // Before approve, so a 'cancel' can't leave a half-approved connection;
            // this await is the async gap `isHandlingRef` covers.
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
                // retried — this deliberately does not reject the proposal.
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
