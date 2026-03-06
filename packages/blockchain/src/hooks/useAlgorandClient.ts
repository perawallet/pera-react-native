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
        if (signer) {
            const encodingSigner: PeraEncodedTransactionSigner = async (
                txnGroup: PeraTransactionGroup,
                indexesToSign: number[],
            ) => {
                logger.debug(
                    `[TX_SIGN] encodingSigner called: txnGroupLen=${txnGroup.length}, indexesToSign=${JSON.stringify(indexesToSign)}`,
                )
                try {
                    const txs = await signer(txnGroup, indexesToSign)
                    logger.debug(
                        `[TX_SIGN] signer returned ${txs.length} signed txns, encoding...`,
                    )
                    for (let i = 0; i < txs.length; i++) {
                        const stx = txs[i]
                        logger.debug(
                            `[TX_SIGN] signedTxn[${i}]: hasSig=${!!stx.sig}, sigLen=${stx.sig?.length ?? 0}, hasAuthAddr=${!!stx.authAddress}`,
                        )
                    }
                    const encoded = encodeSignedTransactions(txs)
                    logger.debug(
                        `[TX_SIGN] encoded ${encoded.length} transactions for submission`,
                    )
                    return encoded
                } catch (e) {
                    logger.error(
                        `[TX_SIGN] signer/encoding error: ${e instanceof Error ? e.message : String(e)}`,
                    )
                    throw e
                }
            }
            client.setDefaultSigner(encodingSigner)
        }
        return client
    }, [network, signer])
}
