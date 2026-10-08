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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { authorityOf } from '../credentials'
import type { WalletAccount } from '../models'
import { useAccountChainStateStore } from '../store'

/** Re-renders only when `authorityOf(account, scope)` changes. */
export const useAuthorityOf = (
    account: WalletAccount,
    scope: ChainScope,
): string | null =>
    // authorityOf reads this same snapshot via getState(); selecting its primitive result re-renders only when the authority changes.
    useAccountChainStateStore(() => authorityOf(account, scope))
