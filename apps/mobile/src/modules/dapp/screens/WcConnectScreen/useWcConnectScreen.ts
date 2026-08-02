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

import { useCallback, useMemo, useState } from 'react'
import {
    useSelectedAccountAddress,
    useSigningAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    type AlgorandChainId,
    type WalletConnectSessionRequest,
} from '@perawallet/wallet-core-walletconnect'
import { useDappRequest } from '../../hooks/useDappRequest.web'

type UseWcConnectScreenResult = {
    /**
     * The approval rendered as the exact shape mobile's ConnectionView header
     * consumes, so the same visuals can be driven from an extension approval
     * message. `null` until a `wc-connect` approval has loaded.
     */
    request: WalletConnectSessionRequest | null
    /**
     * Browser-verified origin of the tab that asked to pair — the ONE
     * trustworthy origin on this screen. Absent for a user-initiated pairing
     * (pasted URI / QR), present when the connect-modal row was clicked.
     */
    requesterOrigin?: string
    /**
     * Whether `requesterOrigin` differs from the origin of the peer-asserted
     * `peerMeta.url` shown above it. False (the ordinary case) lets the header
     * show just the verified badge, since naming the same origin twice reads as
     * duplication; true means the badge cannot stand in for the url, so the
     * verified origin is named explicitly.
     */
    isRequesterOriginDistinct: boolean
    accounts: WalletAccount[]
    selected: Set<string>
    toggle: (address: string) => void
    canConnect: boolean
    isLoading: boolean
    isConnecting: boolean
    handleConnect: () => void
    handleCancel: () => void
    // True once a decision failed to reach the approval bridge. The connect
    // button is left spinning by design (see handleConnect), so without this
    // the window would sit there forever with no explanation.
    deliveryError: boolean
}

// Default selection seed, matching EnableRequestScreen's: the active account
// when it is actually signable, otherwise nothing pre-checked rather than a row
// that can't be granted.
const initialSelection = (
    activeAddress: string | null | undefined,
    accounts: WalletAccount[],
): Set<string> => {
    if (activeAddress && accounts.some(a => a.address === activeAddress)) {
        return new Set([activeAddress])
    }
    return new Set()
}

/**
 * Whether the browser-verified requester origin says something the
 * peer-asserted url above it doesn't.
 *
 * Compared as ORIGINS, not raw strings: `peerMeta.url` routinely carries a path
 * or trailing slash (`https://app.example/connect`) where `requesterOrigin` is
 * always bare (`https://app.example`), and treating that as a mismatch would
 * put the "Request came from …" line back on every ordinary connection — the
 * duplication this exists to remove. An unparseable url counts as distinct:
 * nothing has been shown to be the same, so the origin is named rather than
 * silently vouched for.
 */
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

/**
 * Drives the extension's WalletConnect connect-approval surface.
 *
 * Deliberately does NOT touch `useWalletConnect` / the session-request store:
 * on the extension the offscreen document is the sole connector owner, and
 * `webConnectorOwnership.test.ts` fails any file outside its allowlist that
 * reaches for a connector. Approve/reject travel back through the approval
 * bridge (`useDappRequest`) and the host completes the handshake.
 */
export const useWcConnectScreen = (): UseWcConnectScreenResult => {
    const { approval, isLoading, approve, reject, deliveryError } =
        useDappRequest()
    const accounts = useSigningAccounts()
    const { selectedAccountAddress } = useSelectedAccountAddress()

    const wcConnect = approval?.kind === 'wc-connect' ? approval : undefined

    const [selected, setSelected] = useState<Set<string>>(() =>
        initialSelection(selectedAccountAddress, accounts),
    )
    const [isConnecting, setIsConnecting] = useState(false)

    const request = useMemo<WalletConnectSessionRequest | null>(() => {
        if (!wcConnect) return null
        return {
            clientId: wcConnect.clientId,
            chainId: wcConnect.chainId as AlgorandChainId,
            // Empty rather than a defaulted full set when the message carries
            // none: the panel must never imply the dApp asked for more than it
            // did. (The host always sends what it recorded — this is the
            // shape guard for a message that somehow arrives without it.)
            permissions: wcConnect.permissions ?? [],
            peerMeta: {
                name: wcConnect.peerName ?? wcConnect.origin,
                url: wcConnect.origin,
                icons: wcConnect.peerIcons ?? [],
                description: '',
            },
        }
    }, [wcConnect])

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
        if (!selected.size) return
        setIsConnecting(true)
        // Deliberately no `finally` reset: approve() settles the approval and
        // the bridge closes this window, so re-enabling the button would only
        // ever flicker. A failed approve leaves it spinning rather than
        // inviting a second grant against a handshake that may already be
        // half-completed — the window closing is the terminal state here.
        void approve([...selected])
    }, [approve, selected])

    const handleCancel = useCallback((): void => {
        void reject()
    }, [reject])

    return {
        request,
        requesterOrigin: wcConnect?.requesterOrigin,
        isRequesterOriginDistinct: isDistinctFromPeerUrl(
            wcConnect?.requesterOrigin,
            wcConnect?.origin ?? '',
        ),
        accounts,
        selected,
        toggle,
        canConnect: selected.size > 0,
        isLoading,
        isConnecting,
        handleConnect,
        handleCancel,
        deliveryError,
    }
}
