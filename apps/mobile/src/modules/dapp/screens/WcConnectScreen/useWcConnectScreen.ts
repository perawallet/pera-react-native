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

import { useCallback, useEffect, useRef, useState } from 'react'
import {
    useSelectedAccountAddress,
    useSigningAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { stripUrlScheme } from '@perawallet/wallet-core-shared'
import type { ConnectionPeer } from '@perawallet/wallet-extension-connections'
import {
    openValidatedBrowserUrl,
    toValidatedBrowserUrl,
} from '@modules/webview'
import { useApprovalArming } from '@hooks/useApprovalArming.web'
import { useDappRequest } from '../../hooks/useDappRequest.web'

type UseWcConnectScreenResult = {
    /** `null` until a `connection-proposal` approval has loaded. */
    peer: ConnectionPeer | null
    /** The methods the peer asked for; never defaulted to a full set. */
    permissions: string[]
    /** Browser-verified origin of the requesting tab, the ONE trustworthy origin here; absent for paste/QR. */
    requesterOrigin?: string
    /** True when the badge cannot vouch for the peer-asserted url, so the origin is named. */
    isRequesterOriginDistinct: boolean
    accounts: WalletAccount[]
    selected: Set<string>
    toggle: (address: string) => void
    canConnect: boolean
    isLoading: boolean
    isConnecting: boolean
    handleConnect: () => void
    handleCancel: () => void
    /** The dApp-asserted url without its scheme; rendered as text, never trusted. */
    peerUrlLabel?: string
    /** False when the peer url fails the https gate, so it renders unlinked. */
    canOpenPeerUrl: boolean
    handlePressUrl: () => void
    /** A decision failed to reach the bridge; the button stays spinning by design. */
    deliveryError: boolean
}

// The active account when it is signable, otherwise nothing pre-checked
// rather than a row that can't be granted.
const initialSelection = (
    activeAddress: string | null | undefined,
    accounts: WalletAccount[],
): Set<string> => {
    if (activeAddress && accounts.some(a => a.address === activeAddress)) {
        return new Set([activeAddress])
    }
    return new Set()
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

export const useWcConnectScreen = (): UseWcConnectScreenResult => {
    const { approval, isLoading, approve, reject, deliveryError } =
        useDappRequest()
    const accounts = useSigningAccounts()
    const { selectedAccountAddress } = useSelectedAccountAddress()

    const proposal =
        approval?.kind === 'connection-proposal' ? approval : undefined

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
        setSelected(initialSelection(selectedAccountAddress, accounts))
    }, [proposal, selectedAccountAddress, accounts])
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
        if (!selected.size || !isArmed) return
        setIsConnecting(true)
        // No `finally` reset: approve() settles the approval and the bridge closes
        // this window. A failed approve leaves the button spinning rather than
        // inviting a second grant against a half-completed handshake.
        void approve([...selected])
    }, [approve, selected, isArmed])

    const handleCancel = useCallback((): void => {
        void reject()
    }, [reject])

    // A new browser tab: nothing renders mobile's webview here.
    const handlePressUrl = useCallback((): void => {
        openValidatedBrowserUrl(proposal?.peer.url)
    }, [proposal])

    return {
        peer: proposal?.peer ?? null,
        permissions: proposal?.requested.methods ?? [],
        requesterOrigin: proposal?.requesterOrigin,
        isRequesterOriginDistinct: isDistinctFromPeerUrl(
            proposal?.requesterOrigin,
            proposal?.origin ?? '',
        ),
        accounts,
        selected,
        toggle,
        canConnect: selected.size > 0 && isArmed,
        isLoading,
        isConnecting,
        handleConnect,
        handleCancel,
        peerUrlLabel: stripUrlScheme(proposal?.peer.url),
        canOpenPeerUrl: toValidatedBrowserUrl(proposal?.peer.url) !== null,
        handlePressUrl,
        deliveryError,
    }
}
