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

import { useCallback, useState } from 'react'
import {
    useSelectedAccountAddress,
    useSigningAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ConnectionPeer } from '@perawallet/wallet-extension-connections'
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

    const [selected, setSelected] = useState<Set<string>>(() =>
        initialSelection(selectedAccountAddress, accounts),
    )
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
        if (!selected.size) return
        setIsConnecting(true)
        // No `finally` reset: approve() settles the approval and the bridge closes
        // this window. A failed approve leaves the button spinning rather than
        // inviting a second grant against a half-completed handshake.
        void approve([...selected])
    }, [approve, selected])

    const handleCancel = useCallback((): void => {
        void reject()
    }, [reject])

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
        canConnect: selected.size > 0,
        isLoading,
        isConnecting,
        handleConnect,
        handleCancel,
        deliveryError,
    }
}
