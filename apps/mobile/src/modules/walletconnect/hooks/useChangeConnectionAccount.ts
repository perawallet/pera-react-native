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
    firstHeldAccountOf,
    chainAccountOf,
    accountsSigningOnAll,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    getActiveConnectionRegistry,
    useOptionalConnectionRegistry,
} from '@perawallet/wallet-core-connections'
import type { ConnectionId } from '@perawallet/wallet-extension-connections'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useConnectAccountPicker } from './useConnectAccountPicker'

export type ChangeableConnection = {
    id: ConnectionId
    /** The addresses the connection holds, every chain's. */
    accounts: readonly string[]
    /** The connection's EVM chains; the first is the one the change names. */
    evmChainIds: readonly ChainId[]
}

export type UseChangeConnectionAccountResult = {
    /** The connection's first EVM chain; absent when it holds none. */
    evmChainId: Optional<ChainId>
    /** The account the dApp uses; `null` once it left the wallet. */
    activeEvmAccount: Nullable<WalletAccount>
    /** An EVM chain to change on and a registry to change it through. */
    isAvailable: boolean
    isChanging: boolean
    handleChangeAccount: () => Promise<void>
}

export const useChangeConnectionAccount = ({
    id,
    accounts: heldAddresses,
    evmChainIds,
}: ChangeableConnection): UseChangeConnectionAccountResult => {
    const { t } = useLanguage()
    const { showError } = useErrorToast()
    // Bottom sheets (the in-app browser among them) render above the
    // provider, so its context is out of reach there; the app's one registry
    // is not.
    const registry =
        useOptionalConnectionRegistry() ?? getActiveConnectionRegistry()
    const accounts = useAllAccounts()
    const { pickAccount } = useConnectAccountPicker()
    const [isChanging, setIsChanging] = useState(false)
    // A ref, not `isChanging`: the second tap of a double tap lands before
    // the state from the first has rendered.
    const isBusyRef = useRef(false)

    const evmChainId = evmChainIds[0]
    const activeEvmAccount = useMemo(
        () =>
            evmChainId === undefined
                ? null
                : firstHeldAccountOf(heldAddresses, accounts, evmChainId),
        [heldAddresses, accounts, evmChainId],
    )

    const handleChangeAccount = useCallback(async () => {
        if (!registry || evmChainId === undefined || isBusyRef.current) return
        isBusyRef.current = true
        const failed = t('walletconnect.settings.change_account_failed')
        try {
            // Only the chain the change names: a session also holds the dApp's
            // optional networks, and the handler checks the required ones.
            const candidates = accountsSigningOnAll(accounts, accounts, [
                evmChainId,
            ])
            const picked = await pickAccount({
                accounts: candidates,
                chainId: evmChainId,
                selectedAccountId: activeEvmAccount?.id ?? null,
                title: t('walletconnect.request.account_picker_title'),
            })
            const account = candidates.find(
                candidate => candidate.id === picked,
            )
            const address =
                account && chainAccountOf(account, evmChainId)?.address
            if (!address) return
            setIsChanging(true)
            await registry.changeAccount(id, evmChainId, address)
        } catch (error) {
            showError(error, failed)
        } finally {
            isBusyRef.current = false
            setIsChanging(false)
        }
    }, [
        registry,
        evmChainId,
        accounts,
        pickAccount,
        activeEvmAccount,
        id,
        showError,
        t,
    ])

    return {
        evmChainId,
        activeEvmAccount,
        isAvailable: registry !== null && evmChainId !== undefined,
        isChanging,
        handleChangeAccount,
    }
}
