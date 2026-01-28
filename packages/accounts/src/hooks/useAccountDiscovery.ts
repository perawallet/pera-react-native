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

import { useCallback } from 'react'
import { useKMS } from '@perawallet/wallet-core-kms'
import {
    discoverAccounts as baseDiscoverAccounts,
    discoverRekeyedAccounts as baseDiscoverRekeyedAccounts,
} from '../account-discovery'
import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'

const KEY_DOMAIN = 'account-discovery'

export const useAccountDiscovery = () => {
    const { executeWithSeed } = useKMS()

    const discoverAccounts = useCallback(
        async (params: {
            walletId: string
            derivationType: BIP32DerivationType
            accountGapLimit?: number
            keyIndexGapLimit?: number
        }) => {
            return executeWithSeed(
                params.walletId,
                KEY_DOMAIN,
                async (seed: Uint8Array) => {
                    return baseDiscoverAccounts({
                        ...params,
                        seed: Buffer.from(seed),
                    })
                },
            )
        },
        [executeWithSeed],
    )

    const discoverRekeyedAccounts = useCallback(
        async (params: {
            walletId: string
            derivationType: BIP32DerivationType
            accountGapLimit?: number
            keyIndexGapLimit?: number
            accountAddresses?: string[]
        }) => {
            return executeWithSeed(
                params.walletId,
                KEY_DOMAIN,
                async (seed: Uint8Array) => {
                    return baseDiscoverRekeyedAccounts({
                        ...params,
                        seed: Buffer.from(seed),
                    })
                },
            )
        },
        [executeWithSeed],
    )

    return {
        discoverAccounts,
        discoverRekeyedAccounts,
    }
}
