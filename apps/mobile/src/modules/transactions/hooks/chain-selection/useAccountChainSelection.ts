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

import { useCallback, useMemo } from 'react'

import {
    useAccountChainOptionsResolver,
    type AccountChainOption,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    ChainCapability,
    ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useEnableChainAction } from '@hooks/useEnableChainAction'
import { useLanguage } from '@hooks/useLanguage'
import {
    displayChainOption,
    type DisplayedChainOption,
} from '@utils/chainOptionDisplay'

/** `address` is truncated by the chain's codec for display. */
export type AccountChainRow = DisplayedChainOption<AccountChainOption>

export type UseAccountChainSelectionParams = {
    account: Optional<WalletAccount>
    capability: ChainCapability
    onSelectChain: (chainId: ChainId) => void
    /** Gets the account once it holds the added chain. */
    onChainEnabled?: (account: WalletAccount) => void
}

export type UseAccountChainSelectionResult = {
    rows: AccountChainRow[]
    /** The chain being enabled while its address is derived; unset otherwise. */
    enablingChainId: Optional<ChainId>
    handleSelectChain: (chainId: ChainId) => void
    handleAddChain: (chainId: ChainId) => void
}

export const useAccountChainSelection = ({
    account,
    capability,
    onSelectChain,
    onChainEnabled,
}: UseAccountChainSelectionParams): UseAccountChainSelectionResult => {
    const optionsOf = useAccountChainOptionsResolver(capability)
    const { t } = useLanguage()
    const { enablingChainId, enableChain } = useEnableChainAction(
        t('errors.general.title'),
    )

    const rows = useMemo(
        (): AccountChainRow[] =>
            account ? optionsOf(account).map(displayChainOption) : [],
        [account, optionsOf],
    )
    const rowByChain = useMemo(
        () => new Map(rows.map(row => [row.chainId, row])),
        [rows],
    )

    const handleSelectChain = useCallback(
        (chainId: ChainId) => {
            if (!rowByChain.get(chainId)?.isEnabled) return
            onSelectChain(chainId)
        },
        [rowByChain, onSelectChain],
    )

    const handleAddChain = useCallback(
        (chainId: ChainId) => {
            const row = rowByChain.get(chainId)
            if (!account || !row || row.isEnabled) return
            enableChain(account.id, chainId, onChainEnabled)
        },
        [rowByChain, account, onChainEnabled, enableChain],
    )

    return { rows, enablingChainId, handleSelectChain, handleAddChain }
}
