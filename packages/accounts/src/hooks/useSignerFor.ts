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

import { useMemo } from 'react'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Maybe, Nullable } from '@perawallet/wallet-core-shared'
import { getSignerFor } from '../signer-resolution'
import { useAccountsStore } from '../store'
import type { WalletAccount } from '../models'
import { useSelectedChainStates } from './useSelectedChainStates'

/** The account that signs for `address` on `chainId`, or null. */
export const useSignerFor = (
    address: Maybe<string>,
    chainId: ChainId,
): Nullable<WalletAccount> => {
    const accounts = useAccountsStore(state => state.accounts)
    const chainStates = useSelectedChainStates(chainId)
    return useMemo(
        () => (address ? getSignerFor(address, accounts, chainId) : null),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- chainStates re-runs the memo: getSignerFor reads the chain-state store, not its arguments
        [address, accounts, chainId, chainStates],
    )
}
