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
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    accountsChainAdapters,
    type AuthorityTargetKind,
} from '../chain-adapter'
import type { WalletAccount } from '../models'
import { useAllAccounts } from './useAllAccounts'
import { useSelectedChainStates } from './useSelectedChainStates'

export type UseAuthorityTargetsOptions = {
    isQuantumTargetEnabled?: boolean
}

/**
 * Held accounts that `source`'s signing authority can move to. Empty when the
 * source is missing or the chain can't move authority.
 */
export const useAuthorityTargets = (
    source: WalletAccount | null | undefined,
    kind: AuthorityTargetKind,
    { isQuantumTargetEnabled = false }: UseAuthorityTargetsOptions = {},
): WalletAccount[] => {
    const accounts = useAllAccounts()
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const chainStates = useSelectedChainStates(LEGACY_CHAIN_ID)

    return useMemo(() => {
        const authority = accountsChainAdapters.get(LEGACY_CHAIN_ID).authority
        if (!source || !authority) return []
        return accounts.filter(target =>
            authority.isEligibleTarget(kind, target, source, accounts, scope, {
                isQuantumTargetEnabled,
            }),
        )
    }, [accounts, scope, chainStates, source, kind, isQuantumTargetEnabled])
}
