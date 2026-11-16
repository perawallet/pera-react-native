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
    signingAddressesOn,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'

export type ConnectionGrantInput = {
    accounts: WalletAccount[]
    chainIds: readonly ChainId[]
    evmChainIds: readonly ChainId[]
    otherChainIds: readonly ChainId[]
    requiredChains: Optional<readonly ChainId[]>
    /** The one account EVM chains go to. */
    evmAccount: Nullable<WalletAccount>
}

export type UseConnectionGrantResult = {
    /** Account ids checked for the non-EVM chains. */
    selectedAccounts: string[]
    selectedOtherAccounts: WalletAccount[]
    /** The EVM account's EVM addresses, then each checked account's other-chain ones. */
    grantedAddresses: string[]
    /** Something is granted and no required chain is left without an account. */
    canConnect: boolean
    handleAccountPress: (accountId: string) => void
}

export const useConnectionGrant = ({
    accounts,
    chainIds,
    evmChainIds,
    otherChainIds,
    requiredChains,
    evmAccount,
}: ConnectionGrantInput): UseConnectionGrantResult => {
    const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])

    const selectedOtherAccounts = useMemo(
        () =>
            selectedAccounts.flatMap(accountId => {
                const account = accounts.find(({ id }) => id === accountId)
                return account ? [account] : []
            }),
        [selectedAccounts, accounts],
    )
    const grantedAddresses = useMemo(
        () => [
            ...(evmAccount
                ? signingAddressesOn(evmAccount, accounts, evmChainIds)
                : []),
            ...selectedOtherAccounts.flatMap(account =>
                signingAddressesOn(account, accounts, otherChainIds),
            ),
        ],
        [
            evmAccount,
            selectedOtherAccounts,
            accounts,
            evmChainIds,
            otherChainIds,
        ],
    )
    const isEvmSettled =
        evmAccount !== null ||
        !evmChainIds.some(chainId => requiredChains?.includes(chainId))
    const isOtherSettled =
        selectedOtherAccounts.length > 0 ||
        !otherChainIds.some(chainId => requiredChains?.includes(chainId))
    // A proposal naming no chain grants no address but still settles once.
    const hasGrant =
        chainIds.length === 0
            ? selectedOtherAccounts.length > 0
            : grantedAddresses.length > 0

    const handleAccountPress = useCallback((accountId: string) => {
        setSelectedAccounts(prev =>
            prev.includes(accountId)
                ? prev.filter(existing => existing !== accountId)
                : [...prev, accountId],
        )
    }, [])

    return {
        selectedAccounts,
        selectedOtherAccounts,
        grantedAddresses,
        canConnect: hasGrant && isEvmSettled && isOtherSettled,
        handleAccountPress,
    }
}
