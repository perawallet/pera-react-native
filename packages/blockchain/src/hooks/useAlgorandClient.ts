/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useNetwork } from './useNetwork'
import { useMemo } from 'react'
import { config } from '@perawallet/wallet-core-config'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import {
    PeraEncodedTransactionSigner,
    PeraTransactionGroup,
    PeraTransactionSigner,
} from '../models'
import { encodeSignedTransactions } from '@algorandfoundation/algokit-utils/transact'
import { logger } from '@perawallet/wallet-core-shared'
import { toAlgodError } from '../errors'

/**
 * Placeholder signer attached when no real signer is provided. algokit-utils'
 * `composer.build()` requires a signer reference per transaction even when
 * the caller does not intend to sign through algokit (signing now flows
 * through the XState pipeline in `@perawallet/wallet-core-signing`). Build
 * never invokes the signer — it just attaches the reference — so this
 * placeholder is safe at build time and throws loudly if any unexpected
 * call site tries to use it for actual signing.
 */
const throwIfInvokedSigner: PeraEncodedTransactionSigner = async () => {
    throw new Error(
        'Default algokit signer invoked, but signing should flow through ' +
            'the XState pipeline (useSignAndSubmitGroup). Pass an explicit ' +
            'signer to useAlgorandClient if you need algokit-side signing.',
    )
}

export const useAlgorandClient = (signer?: PeraTransactionSigner) => {
    const { networkConfig, network } = useNetwork()

    return useMemo(() => {
        const algodConfig = {
            server: networkConfig.algodUrl,
            token: config.algodApiKey,
        }
        const indexerConfig = {
            server: networkConfig.indexerUrl,
            token: config.indexerApiKey,
        }
        const client = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
        client.registerErrorTransformer(async error => toAlgodError(error))
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
            client.setDefaultSigner(throwIfInvokedSigner)
        }
        return client
    }, [network, signer])
}
