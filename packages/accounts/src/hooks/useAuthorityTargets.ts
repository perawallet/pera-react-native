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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    accountsChainAdapters,
    type AuthorityTargetKind,
    type AuthorityTargetOptions,
} from '../chain-adapter'
import type { WalletAccount } from '../models'
import { useAllAccounts } from './useAllAccounts'

/**
 * Held accounts that `source`'s signing authority can move to. Empty when the
 * source is missing or the chain can't move authority. `options` are the
 * chain's switches, passed through as given.
 */
export const useAuthorityTargets = (
    source: WalletAccount | null | undefined,
    kind: AuthorityTargetKind,
    scope: ChainScope,
    options: AuthorityTargetOptions = {},
): WalletAccount[] => {
    const accounts = useAllAccounts()
    // Keyed by value: callers pass a fresh options object on every render.
    const optionsKey = JSON.stringify(options)

    return useMemo(() => {
        const authority = accountsChainAdapters.get(scope.chainId).authority
        if (!source || !authority) return []
        const targetOptions = JSON.parse(optionsKey) as AuthorityTargetOptions
        return accounts.filter(target =>
            authority.isEligibleTarget(
                kind,
                target,
                source,
                accounts,
                scope,
                targetOptions,
            ),
        )
    }, [accounts, scope, source, kind, optionsKey])
}
