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
import { useDappRequest } from '../../hooks/useDappRequest'

type UseEnableRequestScreenResult = {
    origin: string
    faviconUrl?: string
    accounts: WalletAccount[]
    selected: Set<string>
    toggle: (address: string) => void
    canConnect: boolean
    isLoading: boolean
    handleConnect: () => void
    handleCancel: () => void
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
    const { approval, isLoading, approve, reject } = useDappRequest()
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

    const canConnect = selected.size > 0

    const handleConnect = useCallback((): void => {
        if (!canConnect) return
        void approve(Array.from(selected))
    }, [approve, canConnect, selected])

    const handleCancel = useCallback((): void => {
        void reject()
    }, [reject])

    return {
        origin: approval?.origin ?? '',
        faviconUrl: approval?.faviconUrl,
        accounts,
        selected,
        toggle,
        canConnect,
        isLoading,
        handleConnect,
        handleCancel,
    }
}
