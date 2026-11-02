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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { signingAddressesOn } from './signer-resolution'
import { useAccountsStore } from './store'

/**
 * Read from the store on every call, so a deleted or demoted account drops
 * out of the answer at once. Unnamed accounts are named by their address.
 */
export const signingAccountAddressesOn = (
    chainId: ChainId,
): { address: string; name: string }[] => {
    const { accounts } = useAccountsStore.getState()
    return accounts.flatMap(account =>
        signingAddressesOn(account, accounts, [chainId]).map(address => ({
            address,
            name: account.name ?? address,
        })),
    )
}
