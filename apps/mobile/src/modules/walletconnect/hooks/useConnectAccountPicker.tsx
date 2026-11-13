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

import { useCallback, useEffect, useRef } from 'react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    generateOrderedUniqueId,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useErrorToast } from '@hooks/useErrorToast'
import { useBottomSheet } from '@modules/bottom-sheet'

export type PickAccountArgs = {
    accounts: WalletAccount[]
    chainId: ChainId
    selectedAccountId: Nullable<string>
    title: string
}

export type UseConnectAccountPickerResult = {
    /** The picked account's id; `null` when dismissed, already open or unloadable. */
    pickAccount: (args: PickAccountArgs) => Promise<Nullable<string>>
}

// Loaded on open: the picker pulls the balance rendering stack into
// `@modules/walletconnect`'s barrel, which every importer (and every spec with
// a partial package mock) would otherwise evaluate.
const loadPickerContent = async () =>
    (await import('../components/ConnectAccountPickerContent'))
        .ConnectAccountPickerContent

export const useConnectAccountPicker = (): UseConnectAccountPickerResult => {
    const { request, dismiss } = useBottomSheet()
    const { showError } = useErrorToast()
    const openIdRef = useRef<Nullable<string>>(null)
    const isMountedRef = useRef(true)
    // Set before the first await, so the second tap of a double tap sees it.
    const isPickingRef = useRef(false)

    // The approval sheet that opened the picker can settle under it (expiry,
    // answered elsewhere); the picker must not stay stacked over nothing.
    useEffect(() => {
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
            if (openIdRef.current) dismiss(openIdRef.current)
        }
    }, [dismiss])

    const pickAccount = useCallback(
        async ({
            accounts,
            chainId,
            selectedAccountId,
            title,
        }: PickAccountArgs): Promise<Nullable<string>> => {
            if (isPickingRef.current) return null
            isPickingRef.current = true
            try {
                let PickerContent: Awaited<ReturnType<typeof loadPickerContent>>
                try {
                    PickerContent = await loadPickerContent()
                } catch (error) {
                    showError(error)
                    return null
                }
                if (!isMountedRef.current) return null
                const id = generateOrderedUniqueId()
                openIdRef.current = id
                const picked = await request<string>({
                    id,
                    contents: (
                        <PickerContent
                            accounts={accounts}
                            chainId={chainId}
                            selectedAccountId={selectedAccountId}
                            title={title}
                        />
                    ),
                    options: {
                        size: 'modal',
                        enablePanDownToClose: true,
                        autoCreateContainer: false,
                    },
                })
                if (openIdRef.current === id) openIdRef.current = null
                // The list was a snapshot; only an id it offered is a pick.
                return accounts.some(account => account.id === picked)
                    ? (picked as string)
                    : null
            } finally {
                isPickingRef.current = false
            }
        },
        [request, showError],
    )

    return { pickAccount }
}
