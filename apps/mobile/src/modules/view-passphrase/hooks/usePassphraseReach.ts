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
    accountChainOptions,
    findAccountByAnyChainAddress,
    hdDiscoveryChains,
    hdIndexOf,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    chainDisplayNameOf,
    useSwitchedOffChainIds,
} from '@perawallet/wallet-core-chain-shared'
import { displayChainOption } from '@utils/chainOptionDisplay'

export type PassphraseLinkedAddress = {
    chainId: ChainId
    displayName: string
    /** Truncated by the chain's codec, for display only. */
    address: string
}

export type UsePassphraseReachParams = {
    /** Any address the account holds, such as the one the view-passphrase flow carries. */
    address: string
}

export type UsePassphraseReachResult = {
    isMultiNetwork: boolean
    networkNames: string[]
    linkedAddresses: PassphraseLinkedAddress[]
}

const SINGLE_NETWORK: UsePassphraseReachResult = {
    isMultiNetwork: false,
    networkNames: [],
    linkedAddresses: [],
}

export const usePassphraseReach = ({
    address,
}: UsePassphraseReachParams): UsePassphraseReachResult => {
    const account = useAccountsStore(
        state => findAccountByAnyChainAddress(state.accounts, address) ?? null,
    )
    const switchedOff = useSwitchedOffChainIds()

    return useMemo(() => {
        if (!account || hdIndexOf(account) === undefined) return SINGLE_NETWORK
        // A BIP39 seed mints on every one of these chains, enabled or not, so
        // the words reach all of them even before the user adds one.
        const seedChains = hdDiscoveryChains()
        if (seedChains.length < 2) return SINGLE_NETWORK

        const linkedAddresses = accountChainOptions(
            account,
            chainId => !switchedOff.includes(chainId),
            'family',
        )
            .filter(option => option.isEnabled)
            .map(displayChainOption)
            .flatMap(({ chainId, displayName, address: truncated }) =>
                truncated === undefined
                    ? []
                    : [{ chainId, displayName, address: truncated }],
            )

        return {
            isMultiNetwork: true,
            networkNames: seedChains.map(
                chainId => chainDisplayNameOf(chainId) ?? chainId,
            ),
            linkedAddresses,
        }
    }, [account, switchedOff])
}
