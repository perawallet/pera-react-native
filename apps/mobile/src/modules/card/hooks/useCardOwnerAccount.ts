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

import { useCardStore } from '@perawallet/wallet-core-card'
import {
    useFindAccountByAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * The local account that created the card. The contract only accepts
 * withdrawal calls from it, and only ever releases funds back to it, so it is
 * the sender for the whole withdraw flow whatever the funding source is now.
 * Null when the card was created from an account no longer in this wallet.
 */
export const useCardOwnerAccount = (): Nullable<WalletAccount> => {
    const ownerAddress = useCardStore(state => state.escrowCardOwner)
    return useFindAccountByAddress(ownerAddress ?? '')
}
