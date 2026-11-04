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

import type {
    TransactionNative,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import { TransactionDetailLayout } from '@modules/signing'
import { useEthereumRecordLayout } from '@modules/ethereum/hooks/useEthereumRecordLayout'
import { useEthereumRecordNft } from '@modules/ethereum/hooks/useEthereumRecordNft'
import { useEthereumTransactionPresentation } from '@modules/ethereum/hooks/useEthereumTransactionPresentation'
import { EthereumTransactionDetailSection } from '../../EthereumTransactionDetailSection'
import { EthereumRecordAmountCard } from '../EthereumRecordAmountCard'
import { EthereumRecordNftCard } from '../EthereumRecordNftCard'

type EthereumRecordReadBodyProps = {
    record: TransactionRecord
    /** The node's decoded copy of the transaction, read in place of the plain summary. */
    transaction: TransactionNative
}

/** The history's facts under the call as it was signed, so an approval or transfer reads as it did then; the balance changes stay below it. */
export const EthereumRecordReadBody = ({
    record,
    transaction,
}: EthereumRecordReadBodyProps) => {
    const presentation = useEthereumTransactionPresentation(
        transaction,
        record.scope,
    )
    const { summary, amountRows } = useEthereumRecordLayout(
        record,
        presentation,
    )
    const { nft, handleOpen } = useEthereumRecordNft(record)

    return (
        <TransactionDetailLayout
            summary={summary}
            chainSection={
                <>
                    {/* A read NFT transfer's own rows name only what the card already shows. */}
                    {!!presentation && !(nft && presentation.isTransfer) && (
                        <EthereumTransactionDetailSection
                            presentation={presentation}
                            isAmountInHero={
                                !!summary.amount || !!summary.isAmountLoading
                            }
                        />
                    )}
                    {nft ? (
                        <EthereumRecordNftCard
                            nft={nft}
                            scope={record.scope}
                            onPress={handleOpen}
                        />
                    ) : (
                        <EthereumRecordAmountCard
                            changes={amountRows}
                            scope={record.scope}
                        />
                    )}
                </>
            }
        />
    )
}
