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

import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-chain-contract'
import { FeeDisplay } from '@modules/signing/components/FeeDisplay'
import { KeyRegistrationSummary } from '@modules/signing/components/KeyRegistrationSummary'
import { SigningAccountDisplay } from '@modules/signing/components/SigningAccountDisplay/SigningAccountDisplay'
import { TransactionReviewLayout } from '../../TransactionReviewLayout'
import type { ReviewBodyProps } from '../../types'
import { TransactionSummaryHeader } from '../TransactionSummaryHeader'

export const AlgorandTransactionReviewBody = ({
    transaction,
    source,
    verifiedOrigin,
}: ReviewBodyProps<PeraDisplayableTransaction>) => (
    <TransactionReviewLayout
        header={
            <TransactionSummaryHeader
                transaction={transaction}
                metadata={source}
                verifiedOrigin={verifiedOrigin}
            />
        }
        participants={<SigningAccountDisplay transaction={transaction} />}
        details={
            transaction.txType === 'keyreg' ? (
                <KeyRegistrationSummary transaction={transaction} />
            ) : undefined
        }
        fee={<FeeDisplay transaction={transaction} />}
    />
)
