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

import { useCallback, useMemo, useRef, useState } from 'react'
import {
    chainAccountOf,
    eligibleChains,
    firstUnreachableChainsNote,
    hasCustody,
    signingAddressesOn,
    useAccountValueTotalsQuery,
    useAllAccounts,
    useSigningAccountsOn,
    useSortedAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    i18nKey,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import type { ConnectionProposal } from '@perawallet/wallet-core-connections'
import type { ConnectionPeerVerificationStatus } from '@perawallet/wallet-extension-connections'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    AppError,
    generateOrderedUniqueId,
    logger,
    toError,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    trackEvent,
    WalletConnectEvent,
    AnalyticsMetadataKey,
} from '@analytics'
import { useEnableChainAction } from '@hooks/useEnableChainAction'
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
import {
    toConnectionPermissions,
    type ConnectionPermission,
} from '../../utils/connectionPermissions'
import { uniqueChainIds } from '../../utils/uniqueChainIds'

export type ConnectionOriginWarning = 'scam' | 'mismatch' | 'unverified'

type ApprovedChain = { chainId: ChainId; address: Optional<string> }

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

export type ConnectionAccountRow = {
    account: WalletAccount
    /** The first requested chain the account signs on; its address is the one shown. */
    chainId: ChainId
}

export type RequestedNetwork = {
    chainId: ChainId
    name: string
    /** Some held account can sign on the chain. */
    isAdded: boolean
    /** Not added, but a held account that can reach the chain could add it. */
    canAdd: boolean
    /** The chain is being added to the accounts that can reach it. */
    isAdding: boolean
    /** Every requested network on this chain is a test network. */
    isTestnet: boolean
}

// An account the chain is missing from but whose custody reaches it. A watch
// account can't sign there, and a hardware account needs its device to derive
// the address, which a sheet can't prompt for.
const canAddChainTo = (account: WalletAccount, chainId: ChainId): boolean =>
    !hasCustody(account, 'watch') &&
    !hasCustody(account, 'hardware') &&
    chainAccountOf(account, chainId) === undefined &&
    eligibleChains(account).includes(chainId)

export type UseConnectionApprovalViewResult = {
    /** The accounts that can sign on the proposal's chains, in the user's sort order. */
    accountRows: ConnectionAccountRow[]
    title: string
    requestedNetworks: RequestedNetwork[]
    handleAddNetwork: (chainId: ChainId) => void
    permissions: ConnectionPermission[]
    /** WalletConnect Verify attested the origin and site safety found nothing against it. */
    isOriginVerified: boolean
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
    /** Shown in place of the account list when no account can connect. */
    noAccountsNote: string
    /** Undefined when the peer's origin is attested or carries no verdict. */
    originWarning?: ConnectionOriginWarning
    /** Host of the transport-attested origin, for display. */
    verifiedOriginLabel?: string
    siteSafety: UseSiteSafetyGateResult
}

const ORIGIN_WARNINGS: Record<
    ConnectionPeerVerificationStatus,
    Optional<ConnectionOriginWarning>
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
    verifiedOriginLabel: Optional<string>,
    peerUrlLabel: Optional<string>,
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
    const peerName = toPeerDisplayText(proposal.peer.name)
    const chainIds = useMemo(
        () => uniqueChainIds(proposal.requested.chains),
        [proposal.requested.chains],
    )
    const accountRows = useMemo(
        () =>
            sortedAccounts.flatMap(account => {
                const chainId = chainIds.find(
                    id =>
                        signingAddressesOn(account, accounts, [id]).length > 0,
                )
                return chainId === undefined ? [] : [{ account, chainId }]
            }),
        [sortedAccounts, accounts, chainIds],
    )
    const { enablingChainId: addingChainId, enableChainOnAccounts } =
        useEnableChainAction(t('account_options.add_network_error'))
    const requestedNetworks = useMemo(
        () =>
            chainIds.map((chainId): RequestedNetwork => {
                const { chains } = getProvider()
                const descriptor = chains.has(chainId)
                    ? chains.get(chainId).descriptor
                    : undefined
                // `requested.networks` is one flat list across chains, so an id
                // two chains share (`mainnet`) counts toward both.
                const requested = (descriptor?.networks ?? []).filter(
                    ({ id }) => proposal.requested.networks.includes(id),
                )
                const isAdded = signingAccounts.some(
                    account =>
                        signingAddressesOn(account, accounts, [chainId])
                            .length > 0,
                )
                return {
                    chainId,
                    name: descriptor?.displayName ?? chainId,
                    isAdded,
                    canAdd:
                        !isAdded &&
                        accounts.some(account =>
                            canAddChainTo(account, chainId),
                        ),
                    isAdding: chainId === addingChainId,
                    isTestnet:
                        requested.length > 0 &&
                        requested.every(({ tier }) => tier === 'testnet'),
                }
            }),
        [
            chainIds,
            signingAccounts,
            accounts,
            addingChainId,
            proposal.requested.networks,
        ],
    )
    const title = useMemo(() => {
        const { chains } = getProvider()
        const families = new Set<string>()
        const names: string[] = []
        for (const chainId of chainIds) {
            if (!chains.has(chainId)) continue
            const { family, displayName } = chains.get(chainId).descriptor
            if (families.has(family)) continue
            families.add(family)
            names.push(displayName)
        }
        const [network, otherNetwork] = names
        if (network === undefined) {
            return t('walletconnect.request.title', { name: peerName })
        }
        return otherNetwork === undefined
            ? t('walletconnect.request.title_network', {
                  name: peerName,
                  network,
              })
            : t('walletconnect.request.title_networks', {
                  name: peerName,
                  network,
                  otherNetwork,
              })
    }, [chainIds, peerName, t])
    const permissions = useMemo(
        () => toConnectionPermissions(proposal.requested.methods),
        [proposal.requested.methods],
    )
    const handleAddNetwork = useCallback(
        (chainId: ChainId) => {
            const addableIds = accounts
                .filter(account => canAddChainTo(account, chainId))
                .map(({ id }) => id)
            if (addableIds.length === 0) return
            enableChainOnAccounts(addableIds, chainId)
        },
        [accounts, enableChainOnAccounts],
    )
    const noAccountsNote = useMemo(
        () =>
            t(
                firstUnreachableChainsNote(
                    accounts,
                    proposal.requested.chains,
                ) ?? i18nKey('walletconnect.request.no_accounts'),
            ),
        [accounts, proposal.requested.chains, t],
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
        accountRows,
        title,
        requestedNetworks,
        handleAddNetwork,
        permissions,
        isOriginVerified:
            proposal.peer.verification?.status === 'valid' &&
            siteSafety.verdict.kind === 'clear',
        selectedAccounts,
        isConnecting,
        handleAccountPress,
        handleConnect,
        handleCancel,
        peerName,
        peerUrlLabel: toPeerHostLabel(proposal.peer.url),
        canOpenPeerUrl: toValidatedBrowserUrl(proposal.peer.url) !== null,
        handlePressUrl,
        noAccountsNote,
        originWarning: proposal.peer.verification
            ? ORIGIN_WARNINGS[proposal.peer.verification.status]
            : undefined,
        verifiedOriginLabel: toPeerHostLabel(
            proposal.peer.verification?.verifiedOrigin,
        ),
        siteSafety,
    }
}
