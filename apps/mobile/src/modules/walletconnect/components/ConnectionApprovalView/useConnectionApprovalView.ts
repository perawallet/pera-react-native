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
import {
    signingAddressesOn,
    useAccountValueTotalsQuery,
    useAllAccounts,
    useSigningAccountsOn,
    useSortedAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import type { ConnectionProposal } from '@perawallet/wallet-core-connections'
import type { ConnectionPeerVerificationStatus } from '@perawallet/wallet-extension-connections'
import {
    AppError,
    generateOrderedUniqueId,
    logger,
    toError,
} from '@perawallet/wallet-core-shared'
import {
    trackEvent,
    WalletConnectEvent,
    AnalyticsMetadataKey,
} from '@analytics'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useQuantumDappWarning } from '@hooks/useQuantumDappWarning'
import {
    useSiteSafetyGate,
    type UseSiteSafetyGateResult,
} from '@modules/site-safety'
import { useWebView, toValidatedBrowserUrl } from '@modules/webview'
import { toPeerDisplayText, toPeerHostLabel } from '@utils/peerDisplay'
import { uniqueChainIds } from '../../utils/uniqueChainIds'

export type ConnectionOriginWarning = 'scam' | 'mismatch' | 'unverified'

type ApprovedChain = { chainId: ChainId; address: string | undefined }

// The chains the session settles with an address, each with its first
// selected address on that chain; a requested chain no selected account holds
// is not approved. With none, the session still logs once, on `fallback`.
const approvedChainsOf = (
    selected: readonly WalletAccount[],
    accounts: WalletAccount[],
    requestedChains: readonly ChainId[],
    fallback: ApprovedChain,
): ApprovedChain[] => {
    const approved = uniqueChainIds(requestedChains).flatMap(chainId => {
        const [address] = selected.flatMap(account =>
            signingAddressesOn(account, accounts, [chainId]),
        )
        return address === undefined ? [] : [{ chainId, address }]
    })
    return approved.length > 0 ? approved : [fallback]
}

export type UseConnectionApprovalViewResult = {
    /** The accounts that can sign on the proposal's chains, in the user's sort order. */
    sortedAccounts: WalletAccount[]
    /** Account ids; an account may connect on more than one chain. */
    selectedAccounts: string[]
    isConnecting: boolean
    handleAccountPress: (accountId: string) => void
    handleConnect: () => Promise<void>
    handleCancel: () => Promise<void>
    /** The dApp-asserted name, cleaned and clamped for display. */
    peerName: string
    /** The dApp-asserted url's host; rendered as text, never trusted. */
    peerUrlLabel?: string
    /** False when the peer url fails the https gate, so it renders unlinked. */
    canOpenPeerUrl: boolean
    handlePressUrl: () => void
    /** Undefined when the peer's origin is attested or carries no verdict. */
    originWarning?: ConnectionOriginWarning
    /** Host of the transport-attested origin, for display. */
    verifiedOriginLabel?: string
    siteSafety: UseSiteSafetyGateResult
}

const ORIGIN_WARNINGS: Record<
    ConnectionPeerVerificationStatus,
    ConnectionOriginWarning | undefined
> = {
    valid: undefined,
    mismatch: 'mismatch',
    unknown: 'unverified',
    scam: 'scam',
}

export type OriginWarningMessage = {
    key: string
    params?: Record<string, string>
}

export const toOriginWarningMessage = (
    originWarning: Exclude<ConnectionOriginWarning, 'unverified'>,
    verifiedOriginLabel: string | undefined,
    peerUrlLabel: string | undefined,
): OriginWarningMessage => {
    if (originWarning === 'scam') {
        return { key: 'walletconnect.request.origin_scam' }
    }
    if (!verifiedOriginLabel) {
        return { key: 'walletconnect.request.origin_unverified' }
    }
    // Hosts can match when only the scheme differs; "from X, not X" reads as nonsense.
    if (!peerUrlLabel || peerUrlLabel === verifiedOriginLabel) {
        return {
            key: 'dapp.approval.request_origin',
            params: { origin: verifiedOriginLabel },
        }
    }
    return {
        key: 'dapp.approval.requester_mismatch',
        params: { origin: verifiedOriginLabel, claimed: peerUrlLabel },
    }
}

// Every action goes straight through `proposal.approve` / `proposal.reject`, so
// the screen carries no protocol branching. The success sheet is deliberately
// NOT shown here: it belongs to whoever outlives this sheet (see `useProposalQueue`).
export const useConnectionApprovalView = (
    proposal: ConnectionProposal,
): UseConnectionApprovalViewResult => {
    const { t } = useLanguage()
    const { errorToast } = useToast()
    const { showError } = useErrorToast()
    const { confirmQuantumDappUsage } = useQuantumDappWarning()
    const { pushWebView } = useWebView()
    const accounts = useAllAccounts()
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    // A proposal naming no chain still logs its session event once.
    const fallbackChainId = scope.chainId
    const signingAccounts = useSigningAccountsOn(proposal.requested.chains)
    // Totals are keyed by address across every chain, so an Ethereum account
    // ranks by its own balance rather than as if empty.
    const { accountValueTotals } = useAccountValueTotalsQuery(
        signingAccounts,
        scope,
        true,
    )
    const { sortedAccounts } = useSortedAccounts(
        signingAccounts,
        accountValueTotals,
        scope.chainId,
    )
    const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
    const [isConnecting, setIsConnecting] = useState(false)
    // Every origin the proposal carries: the claimed url, the one the browser
    // or webview observed, and the one WalletConnect Verify attested.
    const siteSafety = useSiteSafetyGate({
        urls: [
            proposal.peer.url,
            proposal.requesterOrigin,
            proposal.peer.verification?.verifiedOrigin,
        ],
        isFlaggedByWalletConnectVerify:
            proposal.peer.verification?.status === 'scam',
    })
    // Guards both handlers against a double-tap reaching `proposal` twice:
    // Connect has an async gap before `isConnecting` flips (the quantum-warning
    // await) and Cancel has no state-driven disabling at all.
    const isHandlingRef = useRef(false)

    const handleAccountPress = useCallback((accountId: string) => {
        setSelectedAccounts(prev =>
            prev.includes(accountId)
                ? prev.filter(existing => existing !== accountId)
                : [...prev, accountId],
        )
    }, [])

    // Callers already holding `isHandlingRef` (`handleConnect`) call this
    // directly; `handleCancel` would see the guard held and no-op.
    const rejectProposal = useCallback(
        async (reason?: string) => {
            for (const chainId of uniqueChainIds(
                proposal.requested.chains,
                fallbackChainId,
            )) {
                trackEvent(WalletConnectEvent.SessionRejected, {
                    [AnalyticsMetadataKey.DappName]: proposal.peer.name,
                    [AnalyticsMetadataKey.DappUrl]: proposal.peer.url ?? '',
                    [AnalyticsMetadataKey.ChainId]: chainId,
                })
            }
            try {
                await proposal.reject(reason)
            } catch (error) {
                logger.error('Failed to reject a connection proposal', {
                    error,
                })
            }
        },
        [fallbackChainId, proposal],
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

    const { isApprovalAllowed } = siteSafety
    const handleConnect = useCallback(async () => {
        if (isHandlingRef.current || !isApprovalAllowed) return
        isHandlingRef.current = true
        try {
            // No expiry pre-check here: the handler owns that verdict and
            // throws a typed error the catch below maps to copy, and a second
            // check only lets the two answers drift.
            //
            // Before approve, so a 'cancel' can't leave a half-approved connection;
            // this await is the async gap `isHandlingRef` covers.
            const selected = selectedAccounts.flatMap(accountId => {
                const account = accounts.find(({ id }) => id === accountId)
                return account ? [account] : []
            })
            const addresses = selected.flatMap(account =>
                signingAddressesOn(
                    account,
                    accounts,
                    proposal.requested.chains,
                ),
            )
            const decision = await confirmQuantumDappUsage(addresses)
            if (decision === 'cancel') {
                await rejectProposal()
                return
            }

            setIsConnecting(true)
            try {
                await proposal.approve(addresses)
                // Firebase params are scalars, so a session spanning chains logs once per chain.
                for (const { chainId, address } of approvedChainsOf(
                    selected,
                    accounts,
                    proposal.requested.chains,
                    { chainId: fallbackChainId, address: addresses[0] },
                )) {
                    trackEvent(WalletConnectEvent.SessionApproved, {
                        [AnalyticsMetadataKey.DappName]: proposal.peer.name,
                        [AnalyticsMetadataKey.DappUrl]: proposal.peer.url ?? '',
                        [AnalyticsMetadataKey.AccountAddress]: address,
                        [AnalyticsMetadataKey.TotalAccount]:
                            selectedAccounts.length,
                        [AnalyticsMetadataKey.ChainId]: chainId,
                    })
                }
            } catch (error) {
                logger.error('Failed to approve a connection proposal', {
                    error,
                })
                // Only a failure the handler positively types as terminal —
                // an expired handshake above all — settles the proposal;
                // anything else keeps the sheet open so Connect can simply be
                // pressed again, and deliberately does not reject.
                if (error instanceof AppError && !error.metadata.retryable) {
                    showError(
                        error,
                        t('walletconnect.request.error_sheet_title'),
                    )
                    await rejectProposal(toError(error).message)
                } else {
                    errorToast(
                        t('walletconnect.request.error_sheet_title'),
                        t('walletconnect.connection.approve_delivery_failed'),
                    )
                }
            } finally {
                setIsConnecting(false)
            }
        } finally {
            isHandlingRef.current = false
        }
    }, [
        proposal,
        accounts,
        selectedAccounts,
        isApprovalAllowed,
        confirmQuantumDappUsage,
        rejectProposal,
        errorToast,
        showError,
        t,
        fallbackChainId,
    ])

    // dApp-asserted and not yet approved: gated to https:// before the WebView.
    const handlePressUrl = useCallback(() => {
        const validatedUrl = toValidatedBrowserUrl(proposal.peer.url)
        if (!validatedUrl) return
        pushWebView({ id: generateOrderedUniqueId(), url: validatedUrl })
    }, [proposal, pushWebView])

    return {
        sortedAccounts,
        selectedAccounts,
        isConnecting,
        handleAccountPress,
        handleConnect,
        handleCancel,
        peerName: toPeerDisplayText(proposal.peer.name),
        peerUrlLabel: toPeerHostLabel(proposal.peer.url),
        canOpenPeerUrl: toValidatedBrowserUrl(proposal.peer.url) !== null,
        handlePressUrl,
        originWarning: proposal.peer.verification
            ? ORIGIN_WARNINGS[proposal.peer.verification.status]
            : undefined,
        verifiedOriginLabel: toPeerHostLabel(
            proposal.peer.verification?.verifiedOrigin,
        ),
        siteSafety,
    }
}
