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

import { useMemo } from 'react'
import {
    chainAccountOf,
    useAccountChainId,
    useAccountHoldingSources,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import type { Maybe, Optional } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { CopyToClipboardOptions } from '@hooks/useClipboard'
import { useHomeChainScope } from '@hooks/useHomeChainScope'
import { useLanguage } from '@hooks/useLanguage'
import { chainUiFor } from '@modules/chain-ui'
import { chainAddressCopyValue } from '@utils/chainOptionDisplay'
import { useSelectedNetworkSource } from '../../hooks/useSelectedNetworkSource'

export type AccountSelectionCopy = {
    copyValue: string
    copyOptions: CopyToClipboardOptions
}

/**
 * What a long press on the header account copies: the address on the network
 * chip's chain, else on the account's own chain (the 0x one for an EVM-first
 * account). A chain this build doesn't register copies its raw address.
 * Undefined when the account has no address to copy.
 */
export const useAccountSelectionCopy = (
    account: Maybe<WalletAccount>,
): Optional<AccountSelectionCopy> => {
    const { t } = useLanguage()
    const accountChainId = useAccountChainId(
        account,
        useHomeChainScope().chainId,
    )
    const filteredSource = useSelectedNetworkSource(
        useAccountHoldingSources(account),
    )

    return useMemo(() => {
        if (!account) return undefined
        const chainId = filteredSource?.scope.chainId ?? accountChainId
        const address =
            filteredSource?.address ?? chainAccountOf(account, chainId)?.address
        if (!address) return undefined
        // A stored chain this build doesn't register has no adapter or codec to ask.
        if (!getProvider().chains.has(chainId)) {
            return { copyValue: address, copyOptions: {} }
        }
        const { addressCopiedTitle } = chainUiFor(
            getProvider().chains.get(chainId).descriptor.family,
            chainId,
        )
        return {
            copyValue: chainAddressCopyValue(chainId, address),
            copyOptions: {
                title: addressCopiedTitle && t(addressCopiedTitle),
                body: addressCodecs.get(chainId).truncate(address),
            },
        }
    }, [account, accountChainId, filteredSource, t])
}
