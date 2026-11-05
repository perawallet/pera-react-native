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

import type { ReactNode } from 'react'
import type { TransactionRecord } from '@perawallet/wallet-core-chain-contract'
import { TransactionDetailLayout } from '@modules/signing'
import { useEthereumRecordLayout } from '@modules/ethereum/hooks/useEthereumRecordLayout'
import { useEthereumRecordNft } from '@modules/ethereum/hooks/useEthereumRecordNft'
import { EthereumRecordAmountCard } from '../EthereumRecordAmountCard'
import { EthereumRecordNftCard } from '../EthereumRecordNftCard'

type EthereumRecordSummaryProps = {
    record: TransactionRecord
    warnings?: ReactNode
}

/** The record as the backend summarised it: no calldata, so no spender or amount of an approval. */
export const EthereumRecordSummary = ({
    record,
    warnings,
}: EthereumRecordSummaryProps) => {
    const { summary, amountRows, assetLabel } = useEthereumRecordLayout(record)
    const { nft, handleOpen } = useEthereumRecordNft(record)

    return (
        <TransactionDetailLayout
            summary={summary}
            warnings={warnings}
            chainSection={
                nft ? (
                    <EthereumRecordNftCard
                        nft={nft}
                        scope={record.scope}
                        onPress={handleOpen}
                    />
                ) : (
                    <EthereumRecordAmountCard
                        changes={amountRows}
                        scope={record.scope}
                        assetLabel={assetLabel}
                    />
                )
            }
        />
    )
}
