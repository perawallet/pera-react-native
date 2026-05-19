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

import type { AccountInformation } from '@perawallet/wallet-core-blockchain'
import type { OnChainAccountInformationResponse } from './endpoints'

/**
 * AlgoKit's algod account response carries `authAddr` (the rekey/auth
 * address), but the `OnChainAccountInformationResponse` alias inferred from
 * the algod client method does not surface it. This narrows that single field
 * access without widening (or mis-stating) the whole response shape — and
 * documents why the assertion is needed so it stays greppable.
 */
type WithAuthAddr = { authAddr?: { toString(): string } }

export const mapOnChainAccountInformation = (
    response: OnChainAccountInformationResponse,
): AccountInformation => {
    const authAddr = (
        response as OnChainAccountInformationResponse & WithAuthAddr
    ).authAddr
    return {
        address: response.address,
        amount: response.amount,
        minBalance: response.minBalance,
        status: response.status,
        rewards: response.rewards,
        assets: (response.assets ?? []).map(asset => ({
            assetId: asset.assetId,
            amount: asset.amount,
            isFrozen: asset.isFrozen,
        })),
        authAddress: authAddr ? authAddr.toString() : undefined,
    }
}
