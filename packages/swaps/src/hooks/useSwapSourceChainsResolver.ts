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

import { useCallback, useMemo } from 'react'
import {
    useAccountChainOptionsResolver,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { CHAIN_IDS, type ChainId } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScopes } from '@perawallet/wallet-core-chain-shared'
import { hasPeraBackend } from '@perawallet/wallet-core-config'
import { usePeraScopeRefusalsVersion } from '@perawallet/wallet-core-device'

/** Resolves the enabled chains an account can pay from on a network served by Pera. */
export const useSwapSourceChainsResolver = (): ((
    account: WalletAccount,
) => ChainId[]) => {
    const optionsOf = useAccountChainOptionsResolver('swap', {
        isSignerRequired: true,
    })
    // The account capability resolver subscribes to remote flag overrides.
    // Re-read the backend gate on those renders as well as on scope refusals.
    usePeraScopeRefusalsVersion()
    const backedKey = useSelectedScopes(CHAIN_IDS)
        .filter(hasPeraBackend)
        .map(({ chainId }) => chainId)
        .join(',')
    const backedChainIds = useMemo(
        () => new Set(backedKey ? backedKey.split(',') : []),
        [backedKey],
    )
    return useCallback(
        (account: WalletAccount) =>
            optionsOf(account)
                .filter(
                    option =>
                        option.isEnabled && backedChainIds.has(option.chainId),
                )
                .map(option => option.chainId),
        [optionsOf, backedChainIds],
    )
}
