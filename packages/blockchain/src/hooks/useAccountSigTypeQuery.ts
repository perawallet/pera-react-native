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

import { useQuery } from '@tanstack/react-query'
import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useAlgorandClient } from './useAlgorandClient'
import { useNetwork } from './useNetwork'
import { getAccountSigTypeQueryKey } from './querykeys'

export const AccountSigTypes = {
    sig: 'sig',
    msig: 'msig',
    lsig: 'lsig',
    pqsig: 'pqsig',
} as const

export type AccountSigType =
    (typeof AccountSigTypes)[keyof typeof AccountSigTypes]

const isKnownSigType = (value: unknown): value is AccountSigType =>
    typeof value === 'string' && value in AccountSigTypes

const isNotFoundError = (error: unknown): boolean =>
    error instanceof Error &&
    'status' in error &&
    (error as { status: unknown }).status === 404

/**
 * The signature scheme an address uses, as observed by the indexer — the only
 * source that can classify an address the wallet doesn't hold keys for (a
 * post-quantum address is a hash of the PQ key, indistinguishable from an
 * Ed25519 address offline).
 *
 * `null` means unknown, not Ed25519: the indexer derives sig-type from the
 * account's signing history, so an address that never appeared on chain (404)
 * or never signed a transaction cannot be classified.
 */
export const fetchAccountSigType = async (
    algokit: AlgorandClient,
    address: string,
): Promise<Nullable<AccountSigType>> => {
    try {
        const response = await algokit.client.indexer
            .lookupAccountByID(address)
            .exclude('all')
            .do()
        const sigType = response.account.sigType
        return isKnownSigType(sigType) ? sigType : null
    } catch (error) {
        if (isNotFoundError(error)) return null
        throw error
    }
}

type UseAccountSigTypeQueryParams = {
    address: string
    enabled?: boolean
}

export type UseAccountSigTypeQueryResult = {
    /** `null` while loading, on error, and for addresses the indexer cannot classify. */
    sigType: Nullable<AccountSigType>
    isFetching: boolean
}

export const useAccountSigTypeQuery = ({
    address,
    enabled = true,
}: UseAccountSigTypeQueryParams): UseAccountSigTypeQueryResult => {
    const algokit = useAlgorandClient()
    const { network } = useNetwork()

    const query = useQuery({
        queryKey: getAccountSigTypeQueryKey(address, network),
        queryFn: () => fetchAccountSigType(algokit, address),
        enabled: enabled && !!address,
        retry: false,
    })

    return { sigType: query.data ?? null, isFetching: query.isFetching }
}
