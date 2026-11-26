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

import { buildIntegrityHeadersWhenReady } from '@perawallet/wallet-core-app-integrity'
import type { WalletMode } from '@perawallet/wallet-core-chain-contract'
import { queryClient } from '@perawallet/wallet-core-shared'

export const followedTokensPath = (deviceId: string): string =>
    `/api/v3/evm/devices/${deviceId}/followed-tokens/`

export type FollowedTokenAccount = {
    address: string
    /** CAIP-2 id of the network the address is registered on. */
    chain: string
    /** CAIP-19 ids, `eip155:{n}/erc20:{lowercase address}`. */
    tokens: string[]
}

/**
 * Replaces the device's followed tokens: an account left out loses its own.
 * Rejects on a failed request. A 422 comes back in either of two body shapes
 * (the route's and the framework's), so callers never read the body.
 */
export const putFollowedTokens = async (
    deployment: WalletMode,
    deviceId: string,
    accounts: readonly FollowedTokenAccount[],
): Promise<void> => {
    await queryClient<unknown>({
        backend: 'pera',
        deployment,
        method: 'PUT',
        url: followedTokensPath(deviceId),
        headers: await buildIntegrityHeadersWhenReady(),
        data: { accounts },
    })
}
