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
import {
    addressOn,
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useOnrampScope } from '@perawallet/wallet-core-onramp'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type UseOnrampAccountResult = {
    account: Nullable<WalletAccount>
    /** The chain and network Fund buys onto; null when the account can't be funded. */
    scope: Nullable<ChainScope>
    /** The account's address on `scope`'s chain. */
    address: Nullable<string>
}

/** The selected account as Fund sees it. */
export const useOnrampAccount = (): UseOnrampAccountResult => {
    const account = useSelectedAccount() ?? null
    const scope = useOnrampScope(account?.chains ?? null)
    const address =
        account !== null && scope !== null
            ? (addressOn(account, scope) ?? null)
            : null

    return useMemo(
        () => ({ account, scope, address }),
        [account, scope, address],
    )
}
