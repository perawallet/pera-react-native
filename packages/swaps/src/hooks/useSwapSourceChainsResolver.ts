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
import {
    useAccountChainOptionsResolver,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'

/** Resolves the chains an account can pay a swap from. */
export const useSwapSourceChainsResolver = (): ((
    account: WalletAccount,
) => ChainId[]) => {
    const optionsOf = useAccountChainOptionsResolver('swap', {
        isSignerRequired: true,
    })
    return useCallback(
        (account: WalletAccount) =>
            optionsOf(account)
                .filter(option => option.isEnabled)
                .map(option => option.chainId),
        [optionsOf],
    )
}
