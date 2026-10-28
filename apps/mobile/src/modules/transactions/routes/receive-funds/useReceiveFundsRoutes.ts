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

import { useAccountChainOptionsResolver } from '@perawallet/wallet-core-accounts'
import {
    needsChainSelection,
    useReceiveFunds,
} from '@modules/transactions/hooks'
import type { ReceiveFundsStackParamList } from './types'

export type UseReceiveFundsRoutesResult = {
    initialRouteName: keyof ReceiveFundsStackParamList
}

export const useReceiveFundsRoutes = (): UseReceiveFundsRoutesResult => {
    const { canSelectAccount, selectedAccount, chainId } = useReceiveFunds()
    const optionsOf = useAccountChainOptionsResolver('receive')
    if (canSelectAccount) return { initialRouteName: 'AccountSelection' }
    // A caller that pinned the chain already chose it.
    if (chainId !== undefined) return { initialRouteName: 'QRView' }
    const needsChain =
        selectedAccount !== undefined &&
        needsChainSelection(optionsOf(selectedAccount))
    return { initialRouteName: needsChain ? 'ChainSelection' : 'QRView' }
}
