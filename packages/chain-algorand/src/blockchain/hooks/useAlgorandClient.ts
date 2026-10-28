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
    useNetworkStore,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { algorandNetworkOf } from '../../network-id'
import type { PeraTransactionSigner } from '../models'
import { selectAlgorandCustomNetwork } from '../store'
import { createWalletAlgorandClient } from '../utils/createWalletAlgorandClient'

export const useAlgorandClient = (signer?: PeraTransactionSigner) => {
    const network = algorandNetworkOf(useSelectedScope(ALGORAND_CHAIN_ID))
    const customNetwork = useNetworkStore(selectAlgorandCustomNetwork)

    return useMemo(() => {
        return createWalletAlgorandClient(network, signer)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- getChainConfig reads customNetwork when network is 'custom', so a saved config change must rebuild the client
    }, [network, customNetwork, signer])
}
