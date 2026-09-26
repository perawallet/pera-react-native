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
import type { PeraTransactionSigner } from '../models'
import { useCustomNetworkStore } from '../store'
import { createWalletAlgorandClient } from '../utils/createWalletAlgorandClient'
import { useNetwork } from './useNetwork'

export const useAlgorandClient = (signer?: PeraTransactionSigner) => {
    const { network } = useNetwork()
    const customNetwork = useCustomNetworkStore(state => state.customNetwork)

    return useMemo(() => {
        return createWalletAlgorandClient(network, signer)
        // customNetwork (the whole object, not a property of it — oxlint's
        // exhaustive-deps wants the reference itself) is a real dependency:
        // when `network` is 'custom', resolveChainEndpoints reads it, so a
        // saved config change must re-memoize the client rather than leave a
        // mounted screen pointed at the old host until it unmounts.
    }, [network, customNetwork, signer])
}
