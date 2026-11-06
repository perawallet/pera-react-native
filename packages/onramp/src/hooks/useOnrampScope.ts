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
    useAccountCapabilityScope,
    useAccountChainOptionsResolver,
    useAllAccounts,
    type AccountChainOption,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'

import { rampChainAdapters } from '../chain-adapter'
import { useOnrampStore } from '../store'

const isFundableOption = (option: AccountChainOption): boolean =>
    option.isEnabled && rampChainAdapters.has(option.chainId)

/**
 * The scope Fund buys onto for `account`. `chainId` pins it to that chain,
 * with no fallback; null when the chain has no `onramp` or no ramp adapter.
 */
export const useOnrampScope = (
    account: Nullable<WalletAccount>,
    chainId?: ChainId,
): Nullable<ChainScope> => {
    const scope = useAccountCapabilityScope(account, 'onramp', chainId)
    return scope !== null && rampChainAdapters.has(scope.chainId) ? scope : null
}

/** The chains `account` can be funded on, in registry order; a signer is required. */
export const useOnrampDestinationChains = (
    account: Nullable<WalletAccount>,
): ChainId[] => {
    const optionsOf = useAccountChainOptionsResolver('onramp', {
        isSignerRequired: true,
    })
    return useMemo(
        () =>
            account
                ? optionsOf(account)
                      .filter(isFundableOption)
                      .map(option => option.chainId)
                : [],
        [account, optionsOf],
    )
}

/**
 * The scope Fund runs on: the chain the user chose when `account` can be
 * funded there, else its first chain that something held signs for.
 */
export const useOnrampDestinationScope = (
    account: Nullable<WalletAccount>,
): Nullable<ChainScope> => {
    const selectedChainId = useOnrampStore(state => state.selectedChainId)
    const signingChainId = useOnrampDestinationChains(account)[0]
    const chosen = useOnrampScope(account, selectedChainId ?? signingChainId)
    const fallback = useOnrampScope(account, signingChainId)
    return chosen ?? fallback
}

/** Accounts that something held can sign for on a chain they can be funded on. */
export const useOnrampSigningAccounts = (): WalletAccount[] => {
    const accounts = useAllAccounts()
    const optionsOf = useAccountChainOptionsResolver('onramp', {
        isSignerRequired: true,
    })
    return useMemo(
        () =>
            accounts.filter(account =>
                optionsOf(account).some(isFundableOption),
            ),
        [accounts, optionsOf],
    )
}
