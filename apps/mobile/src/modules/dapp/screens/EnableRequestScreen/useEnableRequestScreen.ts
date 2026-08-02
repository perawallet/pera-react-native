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
import { useLanguage } from '@hooks/useLanguage'
import { useDappRequest } from '../../hooks/useDappRequest'

type UseEnableRequestScreenResult = {
    origin: string
    originLabel: string
    requesterOrigin?: string
    faviconUrl?: string
    accounts: WalletAccount[]
    selected: Set<string>
    toggle: (address: string) => void
    canConnect: boolean
    isLoading: boolean
    handleConnect: () => void
    handleCancel: () => void
    // True once a decision failed to reach the approval bridge; the screen
    // keeps this window open and explains why rather than reporting a
    // connection the site never received.
    deliveryError: boolean
}

// Default selection seed: the active account, if it's actually signable
// (present in useSigningAccounts()'s list) — a watch-only active account
// falls back to no default selection rather than pre-checking a row that
// can't be granted.
const initialSelection = (
    activeAddress: string | null | undefined,
    accounts: WalletAccount[],
): Set<string> => {
    if (activeAddress && accounts.some(a => a.address === activeAddress)) {
        return new Set([activeAddress])
    }
    return new Set()
}

export const useEnableRequestScreen = (): UseEnableRequestScreenResult => {
    const { t } = useLanguage()
    const { approval, isLoading, approve, reject, deliveryError } =
        useDappRequest()
    const accounts = useSigningAccounts()
    const { selectedAccountAddress } = useSelectedAccountAddress()

    const [selected, setSelected] = useState<Set<string>>(() =>
        initialSelection(selectedAccountAddress, accounts),
    )

    const toggle = useCallback((address: string): void => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(address)) next.delete(address)
            else next.add(address)
            return next
        })
    }, [])

    // Browser-verified origin of the tab that asked us to pair, present only
    // for page-initiated wc-connect. Distinct from `origin`, which for a WC
    // handshake is the peer's SELF-ASSERTED peerMeta url — the user needs to
    // see which one is which.
    const requesterOrigin =
        approval?.kind === 'wc-connect' ? approval.requesterOrigin : undefined

    const canConnect = selected.size > 0

    const handleConnect = useCallback((): void => {
        if (!canConnect) return
        void approve(Array.from(selected))
    }, [approve, canConnect, selected])

    const handleCancel = useCallback((): void => {
        void reject()
    }, [reject])

    const origin = approval?.origin ?? ''
    // For `wc-connect` this is the dApp's self-asserted `peerMeta.url` — an
    // attacker can set it to any domain, e.g. a bank's, while the same
    // request is truthfully stamped with a completely different
    // `requesterOrigin`. Qualified so it reads as a claim rather than a fact.
    // For ARC-0027 `enable`, `origin` IS browser-verified (there is no
    // separate `requesterOrigin` to distinguish it from), so it is rendered
    // plain — qualifying it here would be misleading, not cautious.
    const originLabel =
        approval?.kind === 'wc-connect'
            ? t('dapp.enable.peer_origin_claim', { origin })
            : origin

    return {
        origin,
        originLabel,
        requesterOrigin,
        faviconUrl: approval?.faviconUrl,
        accounts,
        selected,
        toggle,
        canConnect,
        isLoading,
        handleConnect,
        handleCancel,
        deliveryError,
    }
}
