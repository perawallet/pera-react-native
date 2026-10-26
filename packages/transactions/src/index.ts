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

// Side-effect import: registers the account-removal cleanup handler at module
// scope so it is wired up whenever this package is loaded.
import './register-account-cleanup'

export const name = '@perawallet/wallet-core-transactions'

export * from './models'
export * from './hooks'
export * from './address-safety'
export {
    sendFlowChainAdapters,
    sendFlowFeatureFor,
    toAssetInboxQuote,
    type SendFlowChainAdapter,
    type AssetInboxQuote,
    type AssetInboxRequest,
    type AssetInboxSendFlow,
    type AssetInboxSendSummary,
    type InboxSendTxsParams,
    type InboxClaimTxsParams,
    type InboxRejectTxsParams,
    type TransferTxsParams,
    type ExpressTransferTxsParams,
    type AssetOptInTxsParams,
    type AssetOptOutTxsParams,
    type RekeyTxParams,
    type KeyRegistrationTxParams,
} from './chain-adapter'
export {
    transferChainAdapters,
    holdingReserveOf,
    type TransferChainAdapter,
    type ChainNotice,
    type ReserveNotice,
    type EmptyAccountOffer,
    type SpendableBalance,
    type SpendableBalanceInput,
    type InFlightSpend,
    type RecipientWarningInput,
    type AddressPoisoningRules,
} from './transfer-adapter'
export {
    diffAddressCharacters,
    type AddressPoisoningInput,
    type AddressPoisoningRisk,
    type AddressSegment,
} from './address-poisoning'
export { getInFlightSpends } from './in-flight'
export {
    historyChainAdapters,
    fetchTransactionHistory,
    fetchMoreTransactions,
    hasCachedHistoryRows,
    mapHistoryItemToTransactionNative,
    summarizeHistoryItem,
    historyItemGroupToOpen,
    assetFactsResolverFor,
    TransactionHistoryRowsUnsupportedError,
    type AssetDisplayFacts,
    type AssetFactsResolver,
    type HistoryChainAdapter,
    type HistoryChainDataCodec,
    type TransactionHistoryChainFields,
    type FetchTransactionHistoryParams,
    type FetchMoreTransactionsParams,
} from './history-adapter'
export {
    getPendingTransactionRecords,
    getTransactionHistoryWithPending,
    type GetPendingTransactionRecordsParams,
    type HistoryPageWithPending,
} from './pending-history'
export * from './utils'

// Export DB functions for sync service and other consumers
export {
    upsertTransactions,
    getTransactionHistory,
    getLatestTransactionRoundTime,
    deleteTransactionsForAccount,
    getRowsByChainData,
    getChainDataValue,
    setChainDataValue,
} from './db'

// Export syncer for sync service
export { fetchAndPersistTransactions } from './sync/transaction-syncer'

// Export CSV export functionality
export {
    fetchTransactionsCsv,
    CsvExportError,
    CSV_MIME_TYPE,
    DEFAULT_CSV_FILENAME,
    type DateRange,
    type ExportCsvParams,
    type CsvExportResult,
    type FetchCsvParams,
} from './api/csv-export'

export {
    TransactionError,
    InvalidSendParamsError,
    UnsupportedTransactionIntentError,
    AlreadyOptedInError,
    InsufficientBalanceForOptInError,
    NonZeroBalanceError,
    CreatorCannotOptOutError,
    AssetFrozenError,
    RekeyError,
    type RekeyErrorReason,
} from './errors'
