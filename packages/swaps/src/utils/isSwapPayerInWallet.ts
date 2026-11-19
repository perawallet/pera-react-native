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

import { addressOn, type WalletAccount } from '@perawallet/wallet-core-accounts'
import type { SwapTrackedOrder } from '../models'

/**
 * Whether the account that paid for `order` is still in the wallet. An order
 * whose payer left is no longer followed, so it isn't shown as open either.
 */
export const isSwapPayerInWallet = (
    order: Pick<SwapTrackedOrder, 'sourceScope' | 'sourceAddress'>,
    accounts: readonly WalletAccount[],
): boolean =>
    accounts.some(
        account =>
            addressOn(account, order.sourceScope) === order.sourceAddress,
    )
