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

// Screens other navigators mount, and the send/receive sheets (each hosts its
// own navigator), live in `@modules/transactions/routes`.
export { QuantumFeeExplainer } from './components/QuantumFeeExplainer'
export { TransactionDateHeader } from './components/TransactionDateHeader'
export { TransactionListItem } from './components/TransactionListItem'
export { TransactionHistoryLoadState } from './components/TransactionHistoryLoadState'
export { TransactionHistorySearchOlder } from './components/TransactionHistorySearchOlder'
export { TransactionHistoryFeed } from './components/TransactionHistoryFeed'
export { SendAccountSelectionContent } from './components/send-funds/SendAccountSelectionContent'
export { SuspectedPoisoningNotice } from './components/address-safety/SuspectedPoisoningNotice'
export {
    ComparedAddress,
    KNOWN_LABEL_KEYS,
    type ComparedAddressProps,
} from './components/address-safety/ComparedAddress'
export {
    useReceiveFunds,
    useSendAccountResolver,
    useSendFunds,
    useSendFundsStore,
    useKnownAddresses,
    useSuspectedAddressReuseGuard,
    useTransactionHistoryRows,
    useMergedTransactionHistoryRows,
    type HistoryFeedProps,
    type HistoryFeedSource,
    type UseTransactionHistoryRowsResult,
    type SendAccountResolution,
    type UseKnownAddressesParams,
    type UseKnownAddressesResult,
} from './hooks'
export type {
    SendConfirmationDisplay,
    SendTrailingSectionProps,
} from './types/send-confirmation-display'
export { diffAddresses, type AddressSegment } from './utils/diffAddresses'
export {
    getTransactionRowKey,
    getTransactionRowType,
    type TransactionListRow,
} from './utils/transactionListRows'
