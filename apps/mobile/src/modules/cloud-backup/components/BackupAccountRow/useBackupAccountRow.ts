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
    accountChainOptions,
    useRegisteredChainIds,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { CachedRecordChain } from '@perawallet/wallet-core-backup'
import {
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useSwitchedOffChainIds } from '@perawallet/wallet-core-chain-shared'
import { useIsMultichain } from '@modules/accounts'
import {
    chainAddressCopyValue,
    displayChainOption,
} from '@utils/chainOptionDisplay'

export type BackupAccountChainAddress = {
    chainId: ChainId
    displayName: string
    /** Truncated by the chain's codec. */
    address: string
    copyValue: string
}

type UseBackupAccountRowParams = {
    address: string
    account?: WalletAccount
    /** For an account only the backup holds: its record's chains. */
    backupChains?: CachedRecordChain[]
}

type UseBackupAccountRowResult = {
    /** More than one chain is active; otherwise the row keeps its single-chain layout. */
    isMultichain: boolean
    chainIds: ChainId[]
    chains: BackupAccountChainAddress[]
    canExpand: boolean
    isExpanded: boolean
    onToggle: () => void
}

export const useBackupAccountRow = ({
    address,
    account,
    backupChains,
}: UseBackupAccountRowParams): UseBackupAccountRowResult => {
    const isMultichain = useIsMultichain()
    const registeredChainIds = useRegisteredChainIds()
    const switchedOff = useSwitchedOffChainIds()
    const [isExpanded, setIsExpanded] = useState(false)

    const chains = useMemo((): BackupAccountChainAddress[] => {
        const isOn = (chainId: ChainId) => !switchedOff.includes(chainId)
        if (account) {
            return accountChainOptions(account, isOn).flatMap(option =>
                option.isEnabled && option.address
                    ? [toChainAddress(option.chainId, option.address)]
                    : [],
            )
        }
        // An item written before records names no chain; those were Algorand only.
        const entries = backupChains?.length
            ? backupChains
            : [{ chain: LEGACY_CHAIN_ID, address }]
        return registeredChainIds.filter(isOn).flatMap(chainId => {
            const entry = entries.find(({ chain }) => chain === chainId)
            return entry ? [toChainAddress(chainId, entry.address)] : []
        })
    }, [account, backupChains, address, registeredChainIds, switchedOff])

    const chainIds = useMemo(() => chains.map(chain => chain.chainId), [chains])
    const canExpand = isMultichain && chains.length > 0

    const onToggle = useCallback(() => {
        if (canExpand) setIsExpanded(current => !current)
    }, [canExpand])

    return {
        isMultichain,
        chainIds,
        chains,
        canExpand,
        isExpanded: canExpand && isExpanded,
        onToggle,
    }
}

const toChainAddress = (
    chainId: ChainId,
    address: string,
): BackupAccountChainAddress => {
    const displayed = displayChainOption({ chainId, isEnabled: true, address })
    return {
        chainId,
        displayName: displayed.displayName,
        address: displayed.address ?? address,
        copyValue: chainAddressCopyValue(chainId, address),
    }
}
