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

import {
    addressOn,
    useAccountPresentation,
    type AccountKindPresentation,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Maybe, Nullable } from '@perawallet/wallet-core-shared'

/**
 * `useAccountPresentation` for an account the scope's chain holds. A chain
 * describes only its own accounts from custody, so on a fallback scope the
 * account doesn't live on, it would word them as one of its own.
 */
export const useOwnAccountPresentation = (
    account: Maybe<WalletAccount>,
    scope: ChainScope,
): Nullable<AccountKindPresentation> =>
    useAccountPresentation(
        account && addressOn(account, scope) !== undefined ? account : null,
        scope,
    )
