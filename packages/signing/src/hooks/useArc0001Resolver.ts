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
import type {
    Arc0001ResolveResult,
    Arc0001SignTxnsRequest,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    addressOn,
    hasCustody,
    useAllAccounts,
    useSigningAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { plannerAdapterForScope } from '../chain-adapter'

export type Arc0001ResolverOptions = {
    authorizedAddresses?: Set<string>
    maxTransactions?: number
}

export type UseArc0001ResolverResult = (
    request: Arc0001SignTxnsRequest,
    options?: Arc0001ResolverOptions,
) => Arc0001ResolveResult

const addressesOn = (
    accounts: readonly WalletAccount[],
    scope: ChainScope,
): Set<string> =>
    new Set(
        accounts.flatMap(account => {
            const address = addressOn(account, scope)
            return address === undefined ? [] : [address]
        }),
    )

// Binds `signableAddresses` from the wallet so transports can't forget it.
export const useArc0001Resolver = (
    scope: ChainScope,
): UseArc0001ResolverResult => {
    const signingAccounts = useSigningAccounts(scope.chainId)
    const allAccounts = useAllAccounts()
    const signableAddresses = useMemo(
        () => addressesOn(signingAccounts, scope),
        [signingAccounts, scope],
    )
    const multisigAddresses = useMemo(
        () =>
            addressesOn(
                allAccounts.filter(a => hasCustody(a, 'multisig')),
                scope,
            ),
        [allAccounts, scope],
    )
    return useCallback(
        (request, options = {}) =>
            plannerAdapterForScope(scope).resolveDappRequest(request, {
                signableAddresses,
                multisigAddresses,
                authorizedAddresses: options.authorizedAddresses,
                maxTransactions: options.maxTransactions,
            }),
        [scope, signableAddresses, multisigAddresses],
    )
}
