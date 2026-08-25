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
export * from './utils'

// Export DB functions for sync service and other consumers
export {
    upsertTransactions,
    getTransactionHistory,
    getLatestTransactionRoundTime,
    deleteTransactionsForAccount,
} from './db'

// Export API functions for advanced usage
export {
    fetchTransactionHistory,
    fetchMoreTransactions,
    type FetchTransactionHistoryParams,
    type FetchMoreTransactionsParams,
} from './api/history'

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
    AlreadyOptedInError,
    InsufficientBalanceForOptInError,
    NonZeroBalanceError,
    CreatorCannotOptOutError,
    AssetFrozenError,
    RekeyError,
    type RekeyErrorReason,
} from './errors'
