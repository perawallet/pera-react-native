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

import { Address } from 'algosdk'
import type { OnChainAccountInformationResponse } from './endpoints'

export type AccountInformation = {
    /** microAlgos. */
    minBalance: bigint
    /** microAlgos. */
    amount: bigint
    address: Address
    status: string
    /** microAlgos. */
    rewards: bigint
    /** `amount` in the asset's base units. */
    assets: Array<{ assetId: bigint; amount: bigint; isFrozen: boolean }>
    /** Set only when the account is rekeyed. */
    authorityAddress?: string
}

export const mapOnChainAccountInformation = (
    response: OnChainAccountInformationResponse,
): AccountInformation => {
    return {
        address: Address.fromString(response.address),
        amount: response.amount,
        minBalance: response.minBalance,
        status: response.status,
        rewards: response.rewards,
        assets: (response.assets ?? []).map(asset => ({
            assetId: asset.assetId,
            amount: asset.amount,
            isFrozen: asset.isFrozen,
        })),
        authorityAddress: response.authAddr
            ? response.authAddr.toString()
            : undefined,
    }
}
