/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    resolveArc0001SignTxnRequest,
    type Arc0001ResolveResult,
    type Arc0001SignTxnsRequest,
} from '@perawallet/wallet-core-blockchain'
import {
    isMultisigAccount,
    useAllAccounts,
    useSigningAccounts,
} from '@perawallet/wallet-core-accounts'

export type Arc0001ResolverOptions = {
    authorizedAddresses?: Set<string>
    maxTransactions?: number
}

export type UseArc0001ResolverResult = (
    request: Arc0001SignTxnsRequest,
    options?: Arc0001ResolverOptions,
) => Arc0001ResolveResult

// Binds `signableAddresses` from the wallet so transports can't forget
// it. Non-React callers can use `resolveArc0001SignTxnRequest` directly.
export const useArc0001Resolver = (): UseArc0001ResolverResult => {
    const signingAccounts = useSigningAccounts()
    const allAccounts = useAllAccounts()
    const signableAddresses = useMemo(
        () => new Set(signingAccounts.map(a => a.address)),
        [signingAccounts],
    )
    const multisigAddresses = useMemo(
        () =>
            new Set(allAccounts.filter(isMultisigAccount).map(a => a.address)),
        [allAccounts],
    )
    return useCallback(
        (request, options = {}) =>
            resolveArc0001SignTxnRequest(request, {
                signableAddresses,
                multisigAddresses,
                authorizedAddresses: options.authorizedAddresses,
                maxTransactions: options.maxTransactions,
            }),
        [signableAddresses, multisigAddresses],
    )
}
