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

import { Decimal } from 'decimal.js'
import { getAlgorandClient } from '@perawallet/wallet-core-blockchain'
import { upsertAccountBalance, refreshAccountHoldings } from '../db'
import { useAccountsStore } from '../store'
import type { Network } from '@perawallet/wallet-core-shared'

export async function fetchAndPersistAccount(
    address: string,
    network: Network,
): Promise<void> {
    const algokit = getAlgorandClient(network)
    const info = await algokit.account.getInformation(address)

    const authAddress = info.authAddr?.toString() ?? null

    await upsertAccountBalance({
        accountAddress: address,
        network,
        algoBalance: new Decimal(info.balance.microAlgos.toString()).div(
            1_000_000,
        ),
        totalAssetsOptedIn: info.totalAssetsOptedIn ?? 0,
        totalCreatedAssets: info.totalCreatedAssets ?? 0,
        totalAppsOptedIn: info.totalAppsOptedIn ?? 0,
        minBalance: new Decimal(info.minBalance.microAlgos.toString()).div(
            1_000_000,
        ),
        status: info.status ?? 'Offline',
        authAddress,
    })

    useAccountsStore.getState().updateAccountRekeyAddress(address, authAddress)

    const holdings = (info.assets ?? []).map(a => ({
        assetId: `${a.assetId}`,
        amount: new Decimal((a.amount ?? 0n).toString()),
    }))

    await refreshAccountHoldings({
        accountAddress: address,
        holdings,
        network,
    })
}
