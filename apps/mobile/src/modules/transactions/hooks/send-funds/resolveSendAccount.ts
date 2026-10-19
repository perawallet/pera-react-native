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

import {
    accountChainIdOf,
    canSignWith,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Maybe } from '@perawallet/wallet-core-shared'

export type SendAccountResolution =
    | { kind: 'selected' | 'single'; account: WalletAccount }
    | { kind: 'picker'; accounts: WalletAccount[] }
    | { kind: 'none' }

type ResolveSendAccountParams = {
    accounts: WalletAccount[]
    selectedAccountId: Maybe<string>
    chainId: ChainId
    registeredChainIds: readonly ChainId[]
}

/**
 * Which account a send on `chainId` goes out from. The selected account wins
 * only when it lives on that chain, so a link for another chain never sends
 * from whatever happens to be selected.
 */
export const resolveSendAccount = ({
    accounts,
    selectedAccountId,
    chainId,
    registeredChainIds,
}: ResolveSendAccountParams): SendAccountResolution => {
    const senders = accounts.filter(
        account =>
            accountChainIdOf(account, registeredChainIds) === chainId &&
            canSignWith(account, accounts, chainId),
    )
    const selected = senders.find(account => account.id === selectedAccountId)
    if (selected) return { kind: 'selected', account: selected }
    const [only, ...others] = senders
    if (!only) return { kind: 'none' }
    if (others.length === 0) return { kind: 'single', account: only }
    return { kind: 'picker', accounts: senders }
}
