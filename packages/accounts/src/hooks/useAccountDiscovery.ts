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
import { useKMS } from '@perawallet/wallet-core-kms'
import {
    discoverAccounts as baseDiscoverAccounts,
    discoverRekeyedAccounts as baseDiscoverRekeyedAccounts,
    type GetPublicKey,
} from '../account-discovery'
import { type BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'

export const useAccountDiscovery = () => {
    const { getDerivedPublicKey } = useKMS()

    const sessionGetPublicKey = useCallback(
        async (
            walletKeyId: string,
            params: Parameters<GetPublicKey>[0],
        ): Promise<Uint8Array> => {
            return getDerivedPublicKey(
                walletKeyId,
                params.account,
                params.keyIndex,
                params.derivationType,
            )
        },
        [getDerivedPublicKey],
    )

    const discoverAccounts = useCallback(
        async (params: {
            walletKeyId: string
            derivationType: BIP32DerivationType
            accountGapLimit?: number
            keyIndexGapLimit?: number
        }) => {
            const getPublicKey: GetPublicKey = inner =>
                sessionGetPublicKey(params.walletKeyId, inner)
            return baseDiscoverAccounts({
                ...params,
                getPublicKey,
            })
        },
        [sessionGetPublicKey],
    )

    const discoverRekeyedAccounts = useCallback(
        async (params: { accountAddresses: string[] }) =>
            baseDiscoverRekeyedAccounts(params),
        [],
    )

    return {
        discoverAccounts,
        discoverRekeyedAccounts,
    }
}
