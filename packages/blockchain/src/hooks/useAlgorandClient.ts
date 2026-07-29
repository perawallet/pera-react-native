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
import { logger } from '@perawallet/wallet-core-shared'
import {
    type PeraEncodedTransactionSigner,
    type PeraTransactionGroup,
    type PeraTransactionSigner,
} from '../models'
import { useCustomNetworkStore } from '../store'
import { encodeSignedTransactions } from '../utils/transact'
import { createTimeoutBoundedAlgorandClient } from '../utils/createAlgorandClient'
import { resolveChainEndpoints } from '../utils/algorandClient'
import { useNetwork } from './useNetwork'

const pipelineRoutedSigner: PeraEncodedTransactionSigner = async () => {
    throw new Error(
        'AlgorandClient default signer should not be invoked: signing is routed through the XState pipeline. Use useSignAndSubmitGroup instead.',
    )
}

export const useAlgorandClient = (signer?: PeraTransactionSigner) => {
    const { network } = useNetwork()
    const customNetwork = useCustomNetworkStore(state => state.customNetwork)

    return useMemo(() => {
        const client = createTimeoutBoundedAlgorandClient(
            resolveChainEndpoints(network),
        )
        // algokit-utils defaults this to 10 rounds (~30s) on non-localnet,
        // which expires before a hardware-wallet user can confirm on-device.
        // 1000 rounds (~50min) matches the standard Algorand SDK default.
        client.setDefaultValidityWindow(1000)
        if (signer) {
            const encodingSigner: PeraEncodedTransactionSigner = async (
                txnGroup: PeraTransactionGroup,
                indexesToSign: number[],
            ) => {
                try {
                    const txs = await signer(txnGroup, indexesToSign)
                    return encodeSignedTransactions(txs)
                } catch (e) {
                    logger.error('Transaction signing/encoding failed', {
                        error: e,
                    })
                    throw e
                }
            }
            client.setDefaultSigner(encodingSigner)
        } else {
            client.setDefaultSigner(pipelineRoutedSigner)
        }
        return client
        // customNetwork (the whole object, not a property of it — oxlint's
        // exhaustive-deps wants the reference itself) is a real dependency:
        // when `network` is 'custom', resolveChainEndpoints reads it, so a
        // saved config change must re-memoize the client rather than leave a
        // mounted screen pointed at the old host until it unmounts.
    }, [network, customNetwork, signer])
}
