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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { AccountError } from '../errors'
import type {
    AccountChains,
    AccountCustody,
    AccountWithCustody,
} from '../models'

export type BuildAccountInput<C extends AccountCustody = AccountCustody> = {
    /** Defaults to a fresh ordered unique id. */
    id?: string
    name?: string
    custody: C
    /** The chain the account is created on: it must have an entry there, with a key when the custody is local. */
    chainId: ChainId
    chains: AccountChains
}

/** Builds a `WalletAccount` from its custody and per-chain entries. */
export const buildAccount = <C extends AccountCustody>(
    input: BuildAccountInput<C>,
): AccountWithCustody<C['kind']> => {
    const { id, name, custody, chainId, chains } = input
    const entry = chains[chainId]
    if (!entry) {
        throw new AccountError(`The account has no entry on ${chainId}`)
    }
    if (custody.kind === 'local' && !entry.keyPairId) {
        throw new AccountError(`A local account needs a key on ${chainId}`)
    }
    return {
        id: id ?? generateOrderedUniqueId(),
        ...(name !== undefined ? { name } : {}),
        custody,
        chains,
    } as unknown as AccountWithCustody<C['kind']>
}
