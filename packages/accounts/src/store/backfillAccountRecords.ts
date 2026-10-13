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
import { accountsChainAdapters } from '../chain-adapter'
import type { WalletAccount } from '../models'
import { useAccountsStore } from './store'

const chainIdsOf = (account: WalletAccount): ChainId[] =>
    Object.keys(account.chains) as ChainId[]

const backfillRecord = (account: WalletAccount): WalletAccount =>
    chainIdsOf(account).reduce(
        (record, chainId) =>
            accountsChainAdapters.has(chainId)
                ? (accountsChainAdapters
                      .get(chainId)
                      .backfillRecord?.(record) ?? record)
                : record,
        account,
    )

/**
 * Lets each chain fill in what older account records lack. Chains may read
 * the keystore, so call it once both it and the accounts store have hydrated.
 */
export const backfillAccountRecords = (): void => {
    const { accounts, setAccounts } = useAccountsStore.getState()
    const next = accounts.map(backfillRecord)
    if (next.some((account, index) => account !== accounts[index])) {
        setAccounts(next)
    }
}
