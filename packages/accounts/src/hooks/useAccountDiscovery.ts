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

import { useCallback } from 'react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    discoverAccounts as baseDiscoverAccounts,
    discoverRekeyedAccounts as baseDiscoverRekeyedAccounts,
} from '../account-discovery'
import { deriveHdAccount, type GetPublicKey } from '../chain-adapter'
import { useIsRekeyAvailable } from './useIsRekeyAvailable'

export const useAccountDiscovery = (scope: ChainScope) => {
    const isRekeyAvailable = useIsRekeyAvailable(scope.chainId)

    const sessionGetPublicKey = useCallback(
        async (
            walletKeyId: string,
            params: Parameters<GetPublicKey>[0],
        ): Promise<Uint8Array> => {
            const derived = await deriveHdAccount(scope, walletKeyId, params)
            return derived.publicKey
        },
        [scope],
    )

    const discoverAccounts = useCallback(
        async (params: {
            walletKeyId: string
            accountGapLimit?: number
            keyIndexGapLimit?: number
        }) => {
            const getPublicKey: GetPublicKey = inner =>
                sessionGetPublicKey(params.walletKeyId, inner)
            return baseDiscoverAccounts({
                ...params,
                scope,
                getPublicKey,
            })
        },
        [scope, sessionGetPublicKey],
    )

    // Resolves empty rather than rejecting, so a caller's rekey step is skipped
    // without a failure notice while the capability is off.
    const discoverRekeyedAccounts = useCallback(
        async (params: { accountAddresses: string[] }) =>
            isRekeyAvailable
                ? baseDiscoverRekeyedAccounts({ ...params, scope })
                : [],
        [isRekeyAvailable, scope],
    )

    return {
        discoverAccounts,
        discoverRekeyedAccounts,
    }
}
