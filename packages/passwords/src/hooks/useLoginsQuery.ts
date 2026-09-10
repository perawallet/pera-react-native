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

import { useQuery, type QueryKey } from '@tanstack/react-query'
import type { Login } from '../models/login'
import { listLogins } from '../storage/loginStore'

export const loginsQueryKeyRoot = ['logins'] as const

/**
 * Matches every login query key. Domain and username are sealed on purpose
 * so the set of services a person holds logins for is never readable from
 * disk in the clear — a disk-persisted query cache would defeat that, so
 * this predicate exists to exclude these keys from it.
 */
export const isLoginQuery = (queryKey: QueryKey): boolean =>
    queryKey[0] === loginsQueryKeyRoot[0]

export type UseLoginsQueryResult = {
    logins: Login[]
    isLoading: boolean
    isError: boolean
    error: Error | null
    refetch: () => void
}

export type UseLoginsQueryOptions = {
    /**
     * Defaults to true. Set false to keep `listLogins` from running at all:
     * it materialises every stored secret while building its summaries, so a
     * caller that must not touch the vault yet has to stop the fetch, not just
     * hide the result.
     */
    enabled?: boolean
}

export const useLoginsQuery = ({
    enabled = true,
}: UseLoginsQueryOptions = {}): UseLoginsQueryResult => {
    const query = useQuery({
        queryKey: loginsQueryKeyRoot,
        queryFn: listLogins,
        enabled,
    })

    return {
        logins: query.data ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error as Error | null,
        // refetch() ignores `enabled`, so a disabled caller could otherwise
        // unseal the whole vault through this handle alone.
        refetch: () => {
            if (enabled) {
                void query.refetch()
            }
        },
    }
}
