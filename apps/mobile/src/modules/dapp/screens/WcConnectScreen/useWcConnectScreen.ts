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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    chainAccountOf,
    firstUnreachableChainsNote,
    useAllAccounts,
    useSelectedAccountId,
    useSigningAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    i18nKey,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    chainDisplayNameOf,
    getChainDescriptor,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import {
    resolveDisplayableVerificationTier,
    useProjectByUrlQuery,
    type VerificationTier,
} from '@perawallet/wallet-core-projects'
import type { ConnectionPeer } from '@perawallet/wallet-extension-connections'
import {
    useSiteSafetyGate,
    type UseSiteSafetyGateResult,
} from '@modules/site-safety'
import {
    openValidatedBrowserUrl,
    toValidatedBrowserUrl,
} from '@modules/webview'
import { useApprovalArming } from '@hooks/useApprovalArming.web'
import { useLanguage } from '@hooks/useLanguage'
import { toPeerDisplayText, toPeerHostLabel } from '@utils/peerDisplay'
import { useDappRequest } from '../../hooks/useDappRequest.web'

export type ChainNetworkLabel = {
    chain: string
    network: string
}

type UseWcConnectScreenResult = {
    /** `null` until a `connection-proposal` approval has loaded. */
    peer: ConnectionPeer | null
    /** The dApp-asserted name, cleaned and clamped for display. */
    peerName: string
    /** The methods the peer asked for; never defaulted to a full set. */
    permissions: string[]
    /** Browser-verified origin of the requesting tab, the ONE trustworthy origin here; absent for paste/QR. */
    requesterOrigin?: string
    /** `requesterOrigin` as its host, for display. */
    requesterOriginLabel?: string
    /** True when the peer-asserted url is not the requesting tab, so the screen warns. */
    isRequesterOriginDistinct: boolean
    /** The chain the proposal asks for; the listed accounts and addresses are on it. */
    chainId: ChainId
    /** The proposal's chain and the wallet's network on it; absent for Algorand, whose network TestnetIndicator names. */
    chainNetwork?: ChainNetworkLabel
    /** The dApp registry's tier for the peer url, positive only when the requesting tab is that site. */
    verificationTier?: VerificationTier
    accounts: WalletAccount[]
    selected: Set<string>
    toggle: (address: string) => void
    canConnect: boolean
    isLoading: boolean
    isConnecting: boolean
    handleConnect: () => void
    handleCancel: () => void
    /** The dApp-asserted url's host (punycode); rendered as text, never trusted. */
    peerUrlLabel?: string
    /** False when the peer url fails the https gate, so it renders unlinked. */
    canOpenPeerUrl: boolean
    handlePressUrl: () => void
    /** A decision failed to reach the bridge; the button stays spinning by design. */
    deliveryError: boolean
    siteSafety: UseSiteSafetyGateResult
    /** Shown in place of the account list when no account can connect. */
    noAccountsNote: string
}

// The active account when it is signable, otherwise nothing pre-checked
// rather than a row that can't be granted.
const initialSelection = (
    activeAccountId: string | null | undefined,
    accounts: WalletAccount[],
    chainId: ChainId,
): Set<string> => {
    const active = activeAccountId
        ? accounts.find(a => a.id === activeAccountId)
        : undefined
    const address = active && chainAccountOf(active, chainId)?.address
    return address ? new Set([address]) : new Set()
}

// Compared as ORIGINS: a peer url routinely carries a path or trailing slash
// where `requesterOrigin` is bare. An unparseable url counts as distinct.
const isDistinctFromPeerUrl = (
    requesterOrigin: string | undefined,
    peerUrl: string,
): boolean => {
    if (!requesterOrigin) return false
    try {
        return new URL(peerUrl).origin !== requesterOrigin
    } catch {
        return true
    }
}

const chainNetworkOf = ({
    chainId,
    networkId,
}: ChainScope): ChainNetworkLabel => ({
    chain: chainDisplayNameOf(chainId) ?? chainId,
    network:
        getChainDescriptor(chainId).networks.find(({ id }) => id === networkId)
            ?.displayName ?? networkId,
})

export const useWcConnectScreen = (): UseWcConnectScreenResult => {
    const { approval, isLoading, approve, reject, deliveryError } =
        useDappRequest()
    const proposal =
        approval?.kind === 'connection-proposal' ? approval : undefined
    // Every proposal reaching this window names one chain.
    const chainId = proposal?.requested.chains[0] ?? LEGACY_CHAIN_ID
    const accounts = useSigningAccounts(chainId)
    const { t } = useLanguage()
    const allAccounts = useAllAccounts()
    const noAccountsNote = useMemo(
        () =>
            t(
                firstUnreachableChainsNote(allAccounts, [chainId]) ??
                    i18nKey('walletconnect.request.no_accounts'),
            ),
        [allAccounts, chainId, t],
    )
    const scope = useSelectedScope(chainId)
    // Only Algorand's Pera backend serves the dApp registry, and it is keyed by
    // url alone, so every chain's proposal is checked against it there.
    const registryScope = useSelectedScope(LEGACY_CHAIN_ID)
    const { selectedAccountId } = useSelectedAccountId()

    // The page's claimed url and the tab the browser says sent the request.
    const siteSafety = useSiteSafetyGate({
        urls: [proposal?.peer.url, proposal?.requesterOrigin],
    })

    const isArmed = useApprovalArming()
    const [selected, setSelected] = useState<Set<string>>(() => new Set())

    // A default account only for a pairing the user started inside the wallet
    // (paste, QR) — see `useApprovalArming` for why a page-initiated one gets
    // none. Waits for the account store to rehydrate in this fresh window;
    // seeding from an empty list would be a one-shot that never retries.
    const hasSeededRef = useRef(false)
    useEffect(() => {
        if (hasSeededRef.current || !proposal || accounts.length === 0) return
        hasSeededRef.current = true
        if (proposal.requesterOrigin) return
        setSelected(initialSelection(selectedAccountId, accounts, chainId))
    }, [proposal, selectedAccountId, accounts, chainId])
    const [isConnecting, setIsConnecting] = useState(false)

    const toggle = useCallback((address: string): void => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(address)) {
                next.delete(address)
            } else {
                next.add(address)
            }
            return next
        })
    }, [])

    const handleConnect = useCallback((): void => {
        if (!selected.size || !isArmed || !siteSafety.isApprovalAllowed) return
        setIsConnecting(true)
        // No `finally` reset: approve() settles the approval and the bridge closes
        // this window. A failed approve leaves the button spinning rather than
        // inviting a second grant against a half-completed handshake.
        void approve([...selected])
    }, [approve, selected, isArmed, siteSafety.isApprovalAllowed])

    const isRequesterOriginDistinct = isDistinctFromPeerUrl(
        proposal?.requesterOrigin,
        proposal?.origin ?? '',
    )

    const { data: project } = useProjectByUrlQuery({
        scope: registryScope,
        url: proposal?.peer.url,
        isEnabled: !!proposal?.peer.url,
    })
    // The registry is keyed by the peer-asserted url, so a positive tier only
    // shows when the browser-verified tab is that same site. A page asserting
    // someone else's url never inherits their checkmark.
    const verificationTier = resolveDisplayableVerificationTier(
        project,
        isRequesterOriginDistinct ? undefined : proposal?.requesterOrigin,
        siteSafety.verdict.kind !== 'clear',
    )

    const handleCancel = useCallback((): void => {
        void reject()
    }, [reject])

    // A new browser tab: nothing renders mobile's webview here.
    const handlePressUrl = useCallback((): void => {
        openValidatedBrowserUrl(proposal?.peer.url)
    }, [proposal])

    return {
        peer: proposal?.peer ?? null,
        peerName: toPeerDisplayText(proposal?.peer.name),
        permissions: proposal?.requested.methods ?? [],
        requesterOrigin: proposal?.requesterOrigin,
        requesterOriginLabel: toPeerHostLabel(proposal?.requesterOrigin),
        isRequesterOriginDistinct,
        chainId,
        chainNetwork:
            chainId === LEGACY_CHAIN_ID ? undefined : chainNetworkOf(scope),
        verificationTier,
        accounts,
        selected,
        toggle,
        canConnect:
            selected.size > 0 && isArmed && siteSafety.isApprovalAllowed,
        isLoading,
        isConnecting,
        handleConnect,
        handleCancel,
        peerUrlLabel: toPeerHostLabel(proposal?.peer.url),
        canOpenPeerUrl: toValidatedBrowserUrl(proposal?.peer.url) !== null,
        handlePressUrl,
        deliveryError,
        siteSafety,
        noAccountsNote,
    }
}
