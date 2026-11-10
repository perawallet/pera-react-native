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

export { ExternalTransactionInfoContent } from './components/ExternalTransactionInfoContent'
export { GroupDetailHeader } from './screens/GroupDetailScreen/GroupDetailHeader'
export { SourceMetadataBadge } from './components/SourceMetadataBadge'
export { useSignRequestScope } from './hooks/useSignRequestScope'
export { useTransactionHeroTitle } from './hooks/useTransactionHeroTitle'
export {
    CollectionApprovalWarning,
    type CollectionApprovalWarningProps,
} from './components/CollectionApprovalWarning'
export {
    SpendApprovalWarning,
    type SpendApprovalWarningProps,
} from './components/SpendApprovalWarning'
export { isKnownContractSite } from './utils/knownContractSite'
export {
    spendApprovalTitleOf,
    useSpendApprovalTitle,
} from './components/SpendApprovalTitle'
export {
    PredictedFailureMessage,
    type PredictedFailureMessageProps,
} from './components/PredictedFailureMessage'
export {
    ReviewWarningText,
    type ReviewWarningItem,
} from './components/ReviewWarningsBanner'
export {
    BalanceImpactSection,
    balanceImpactItemOf,
    type BalanceImpactItem,
} from './components/BalanceImpactSummary'
export { TransactionReviewLayout } from './transactions/TransactionReviewLayout'
export { TransactionDetailLayout } from './transactions/TransactionDetailLayout'
export type { TransactionDetailLayoutProps } from './transactions/TransactionDetailLayout'
export { TransactionDetailCard } from './transactions/TransactionDetailCard'
export { TransactionDetailAddress } from './transactions/TransactionDetailAddress'
export { TransactionDetailHero } from './transactions/TransactionDetailLayout/TransactionDetailHero'
export { TransactionStatusBadge } from './transactions/TransactionStatusBadge'
export type {
    DetailBodyProps,
    RecordDetailBodyProps,
    PreviewRowProps,
    RelatedTransactionsProps,
    ReviewBodyProps,
    TotalFeeProps,
    TransactionDetailAmount,
    TransactionDetailStatus,
    TransactionDetailSummary,
    TransactionDisplay,
    UseTransactionDetailParams,
    UseTransactionDetailResult,
} from './transactions/types'
