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
    addressCodecs,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { LocalAccount, WalletAccount } from './models'
import { buildAccount } from './credentials'
import { recordAuthority } from './store/recordAuthority'
import {
    accountsChainAdapters,
    fetchDelegatedAddresses,
    hdDeriveOpts,
    type GetPublicKey,
} from './chain-adapter'
import { hdPathKey, walkHdTree, type HdBatchProbe } from './hd-walk'

type DiscoverAccountsParams = {
    scope: ChainScope
    getPublicKey: GetPublicKey
    walletKeyId: string
    accountGapLimit?: number
    keyIndexGapLimit?: number
}

export async function discoverAccounts({
    scope,
    getPublicKey,
    walletKeyId,
    accountGapLimit,
    keyIndexGapLimit,
}: DiscoverAccountsParams): Promise<LocalAccount[]> {
    const adapter = accountsChainAdapters.get(scope.chainId)
    const codec = addressCodecs.get(scope.chainId)
    const deriveOpts = hdDeriveOpts(scope)
    const addressOf = (account: WalletAccount) =>
        account.chains[scope.chainId]?.address ?? ''
    const built = new Map<string, LocalAccount>()

    const probe: HdBatchProbe = async indices => {
        const accounts: LocalAccount[] = []
        for (const hd of indices) {
            const address = codec.fromPublicKey(
                await getPublicKey(hd),
                deriveOpts,
            )
            const account = buildAccount({
                custody: { kind: 'local', seed: 'bip39', hd },
                chainId: adapter.chainId,
                chains: {
                    [adapter.chainId]: {
                        address,
                        keyPairId: adapter.hdKeyPairId(walletKeyId, hd),
                    },
                },
            })
            built.set(hdPathKey(hd), account)
            accounts.push(account)
        }
        const activity = await adapter.checkActivity(
            accounts.map(addressOf),
            scope,
        )
        return accounts.map(
            account => activity.get(addressOf(account)) ?? false,
        )
    }

    const active = await walkHdTree({
        probe,
        accountGapLimit,
        keyIndexGapLimit,
    })

    if (active.length === 0) {
        const zeroAccount = built.get(hdPathKey({ account: 0, keyIndex: 0 }))
        return zeroAccount ? [zeroAccount] : []
    }

    return active.map(index => built.get(hdPathKey(index))!)
}

type DiscoverDelegatedAccountsParams = {
    /**
     * Authority addresses to scan: every on-chain account whose authority is
     * one of these is returned as a watch-account candidate labeled with it.
     */
    accountAddresses: string[]
    scope: ChainScope
}

/** Address-driven: every caller passes the authorities to scan. */
export async function discoverDelegatedAccounts({
    accountAddresses,
    scope,
}: DiscoverDelegatedAccountsParams): Promise<WalletAccount[]> {
    const { chainId } = scope

    const tasks = accountAddresses.map(async address => {
        const delegatedAddresses = await fetchDelegatedAddresses(address, scope)

        return delegatedAddresses.map((delegatedAddress): WalletAccount => {
            recordAuthority(scope, delegatedAddress, address)
            return buildAccount({
                custody: { kind: 'watch' },
                chainId,
                chains: { [chainId]: { address: delegatedAddress } },
            })
        })
    })

    const results = await Promise.all(tasks)
    return results.flat()
}
