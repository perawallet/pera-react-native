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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { cardAdapterFor } from '../chain-adapter'

export type UseCardAutoDrawResult = {
    /** Registers the delegation, then switches auto-draw on chain. */
    enableAutoDraw: (
        account: WalletAccount,
        cardAddress: string,
    ) => Promise<void>
    disableAutoDraw: (account: WalletAccount) => Promise<void>
}

export const useCardAutoDraw = (scope: ChainScope): UseCardAutoDrawResult => {
    // The chain picks the hook, so a scope must not change chain while mounted.
    const useAutoDraw = cardAdapterFor(scope).useAutoDraw
    const operations = useAutoDraw()

    const enableAutoDraw = useCallback(
        (account: WalletAccount, cardAddress: string) =>
            operations.enableAutoDraw(account, cardAddress, scope),
        [operations, scope],
    )
    const disableAutoDraw = useCallback(
        (account: WalletAccount) => operations.disableAutoDraw(account, scope),
        [operations, scope],
    )

    return useMemo(
        () => ({ enableAutoDraw, disableAutoDraw }),
        [enableAutoDraw, disableAutoDraw],
    )
}
