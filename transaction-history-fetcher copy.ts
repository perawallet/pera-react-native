/**
 * TypeScript Implementation of Pera Wallet Transaction History Fetcher
 *
 * This module provides a minimal, dependency-free way to fetch transaction history
 * from the Pera Wallet Mobile API using native fetch.
 *
 * Based on the Android Kotlin implementation from:
 * - TransactionHistoryApiService.kt
 * - DefaultTransactionHistoryPagingSource.kt
 * - TransactionHistoryResponse.kt
 * - TransactionHistoryItemResponse.kt
 */

// =============================================================================
// BASE URL CONFIGURATION
// =============================================================================

/**
 * The base URL for the Pera Wallet Mobile API.
 *
 * Mainnet: "https://mainnet.api.perawallet.app/"
 * Testnet: "https://testnet.api.perawallet.app/"
 *
 * This is the backend service that provides enriched transaction data including
 * swap details and interpreted transaction meanings, as opposed to the raw
 * Algorand Indexer API.
 */
const PERA_API_BASE_URL = 'https://mainnet.api.perawallet.app/'

// =============================================================================
// ENUMS AND CONSTANTS
// =============================================================================

/**
 * Enumeration of all possible Algorand transaction types.
 *
 * These map directly to the transaction types returned by the API.
 * Each type represents a different kind of operation on the Algorand blockchain.
 */
export enum TransactionType {
    /** Standard payment transaction (ALGO transfer) */
    PAY = 'pay',

    /** Asset transfer transaction (ASA transfer) */
    AXFER = 'axfer',

    /** Asset configuration (create/modify/destroy asset) */
    ACFG = 'acfg',

    /** Asset freeze transaction */
    AFRZ = 'afrz',

    /** Application call (smart contract interaction) */
    APPL = 'appl',

    /** Key registration (participation in consensus) */
    KEYREG = 'keyreg',

    /** Heartbeat transaction (node heartbeat) */
    HB = 'hb',
}

/**
 * Default number of transactions to fetch per page.
 * This matches the Android implementation's ITEM_PER_PAGE constant.
 */
const DEFAULT_ITEMS_PER_PAGE = 25

// =============================================================================
// TYPE DEFINITIONS - REQUEST PARAMETERS
// =============================================================================

/**
 * Parameters for fetching transaction history.
 *
 * These parameters control filtering and pagination of the transaction list.
 * All fields are optional except for the account address.
 */
export interface GetTransactionHistoryParams {
    /**
     * The Algorand account address to fetch transactions for.
     * This should be a 58-character base32-encoded string starting with a letter.
     * Example: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ"
     */
    accountAddress: string

    /**
     * Optional: Filter transactions to only show those involving a specific asset.
     * This is the asset ID (ASA ID) as a number.
     * Example: 31566704 (USDC on Algorand)
     * If not provided, returns all asset transactions.
     */
    assetId?: number

    /**
     * Optional: Only return transactions confirmed after this time.
     * Format: ISO 8601 timestamp string.
     * Example: "2024-01-01T00:00:00Z"
     * Useful for date range filtering.
     */
    afterTime?: string

    /**
     * Optional: Only return transactions confirmed before this time.
     * Format: ISO 8601 timestamp string.
     * Example: "2024-12-31T23:59:59Z"
     * Useful for date range filtering.
     */
    beforeTime?: string

    /**
     * Optional: Maximum number of transactions to return per request.
     * Default: 25
     * Maximum: Depends on API limits (typically 100)
     * Use this to control pagination size.
     */
    limit?: number
}

/**
 * Parameters for fetching the next or previous page of results.
 *
 * The API uses cursor-based pagination where the full URL for the next/previous
 * page is provided in the response. This is more efficient than offset-based
 * pagination for blockchain data.
 */
export interface GetMoreTransactionsParams {
    /**
     * The full URL to fetch the next or previous page.
     * This URL is provided by the API in the previous response's nextUrl or previousUrl field.
     * It already includes all query parameters and cursor information.
     *
     * Example: "https://mainnet.api.perawallet.app/v1/accounts/AAA...AAA/transactions/?limit=25&cursor=xyz"
     */
    url: string
}

// =============================================================================
// TYPE DEFINITIONS - API RESPONSE MODELS
// =============================================================================

/**
 * Represents the swap group details for a DEX swap transaction.
 *
 * When a user performs a swap (e.g., on Tinyman or Pact), multiple transactions
 * are grouped together. This object contains the aggregate details.
 */
export interface TransactionHistorySwapGroupDetailResponse {
    /** The asset ID being swapped from (input asset) */
    assetInId: number

    /** The ticker symbol/unit name of the input asset (e.g., "ALGO", "USDC") */
    assetInUnitName: string

    /** The asset ID being swapped to (output asset) */
    assetOutId: number

    /** The ticker symbol/unit name of the output asset */
    assetOutUnitName: string

    /** The amount of input asset being swapped, as a string to preserve precision */
    amountIn: string

    /** The amount of output asset received, as a string to preserve precision */
    amountOut: string
}

/**
 * Represents an asset summary within a transaction.
 *
 * This provides basic information about an asset involved in the transaction.
 */
export interface TransactionHistoryAssetSummaryResponse {
    /** The asset ID (ASA ID) */
    assetId: number

    /** The display name of the asset (e.g., "USD Coin") */
    name: string

    /** The unit name/ticker symbol (e.g., "USDC") */
    unitName: string

    /** Number of decimal places for the asset (0-19) */
    decimals: number
}

/**
 * Represents the interpreted meaning of a transaction.
 *
 * The Pera API enriches transaction data by interpreting what the transaction
 * actually represents (e.g., "Received 100 USDC from 0x123...").
 */
export interface TransactionHistoryInterpretedMeaning {
    /** Human-readable title describing the transaction */
    title: string

    /** Human-readable description with details */
    description: string
}

/**
 * Represents a single transaction item in the history.
 *
 * This is the core data structure containing all details about one transaction.
 * It includes the transaction ID, type, sender, receiver, amounts, fees, etc.
 */
export interface TransactionHistoryItemResponse {
    /**
     * The unique transaction ID (TXID).
     * This is a 52-character base32-encoded string that uniquely identifies the transaction.
     * Example: "ABC123...XYZ"
     */
    id: string

    /**
     * The type of transaction (pay, axfer, appl, etc.)
     * See TransactionType enum for all possible values.
     */
    tx_type: TransactionType

    /**
     * The sender's Algorand address.
     * This is the account that initiated and signed the transaction.
     * Example: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ"
     */
    sender: string

    /**
     * The receiver's Algorand address.
     * This is the account that received the funds/assets.
     * Note: May be null for certain transaction types.
     */
    receiver: string | null

    /**
     * The block round number when this transaction was confirmed.
     * Each block on Algorand represents approximately 3-4 seconds.
     * This can be used to determine transaction ordering and timing.
     */
    confirmed_round: number

    /**
     * Unix timestamp (in seconds) when the transaction was confirmed.
     * This is the blockchain time, not the local device time.
     * Can be converted to a Date object with: new Date(round_time * 1000)
     */
    round_time: number

    /**
     * Details about a swap transaction group.
     * Only present if this transaction is part of a DEX swap.
     * Contains aggregate information about the swap.
     */
    swap_group_detail: TransactionHistorySwapGroupDetailResponse | null

    /**
     * Human-readable interpretation of what this transaction represents.
     * Provided by the Pera API to give context about the transaction.
     */
    interpreted_meaning: TransactionHistoryInterpretedMeaning | null

    /**
     * Transaction fee paid in microAlgos (1 ALGO = 1,000,000 microAlgos).
     * Stored as a string to preserve precision.
     * Example: "1000" = 0.001 ALGO
     */
    fee: string

    /**
     * Group ID for atomic transactions.
     * When multiple transactions must all succeed or all fail together,
     * they share a group ID. This is used for swaps, complex DeFi operations, etc.
     */
    group_id: string | null

    /**
     * The amount transferred, as a string to preserve precision.
     * For ALGO transfers, this is in microAlgos.
     * For asset transfers, this is in the asset's base units (consider decimals).
     * Example: "1000000" = 1 ALGO
     */
    amount: string | null

    /**
     * The close remainder to address.
     * If set, this transaction closes the sender's account and sends all remaining
     * balance to this address after the transaction amount is deducted.
     */
    close_to: string | null

    /**
     * Asset details for asset-related transactions.
     * Contains information about the asset being transferred or configured.
     */
    asset: TransactionHistoryAssetSummaryResponse | null

    /**
     * Application ID for application call transactions (smart contracts).
     * This identifies the smart contract being invoked.
     */
    application_id: number | null

    /**
     * Number of inner transactions if this is an application call.
     * Smart contracts can trigger other transactions (asset transfers, payments, etc.)
     * as part of their execution. This field shows how many inner transactions occurred.
     */
    inner_transaction_count: number | null
}

/**
 * The main response structure from the transaction history API.
 *
 * This wraps the list of transactions with pagination information.
 */
export interface TransactionHistoryResponse {
    /**
     * The current blockchain round when this data was fetched.
     * Useful for determining how fresh the data is.
     */
    current_round: number

    /**
     * URL to fetch the next page of results.
     * If null, there are no more transactions to fetch (you're at the end).
     * This is a full URL including the base path and all query parameters.
     */
    next: string | null

    /**
     * URL to fetch the previous page of results.
     * If null, there are no previous transactions (you're at the beginning).
     * This is a full URL including the base path and all query parameters.
     */
    previous: string | null

    /**
     * The list of transactions for this page.
     * Each item is a TransactionHistoryItemResponse with full transaction details.
     * The length of this array will be at most 'limit' items.
     */
    results: TransactionHistoryItemResponse[]
}

// =============================================================================
// PAGINATION HELPER TYPES
// =============================================================================

/**
 * Represents the current pagination state.
 *
 * This is useful for tracking where you are in the pagination and
 * determining if you can go forward or backward.
 */
export interface PaginationState {
    /**
     * Whether there are more pages to fetch (forward pagination).
     * If true, you can call getNextPage() to fetch more transactions.
     */
    hasNextPage: boolean

    /**
     * Whether there are previous pages to fetch (backward pagination).
     * If true, you can call getPreviousPage() to go back.
     */
    hasPreviousPage: boolean

    /**
     * The URL for the next page (if hasNextPage is true).
     * Pass this to getMoreTransactions() to fetch the next page.
     */
    nextUrl: string | null

    /**
     * The URL for the previous page (if hasPreviousPage is true).
     * Pass this to getMoreTransactions() to fetch the previous page.
     */
    previousUrl: string | null

    /**
     * Total number of transactions fetched so far across all pages.
     */
    totalFetched: number
}

/**
 * Result object returned by the paginated fetch functions.
 *
 * This wraps the response data with pagination state and convenience methods.
 */
export interface PaginatedTransactionResult {
    /** The array of transactions for the current page */
    transactions: TransactionHistoryItemResponse[]

    /** The current pagination state (next/previous URLs, flags) */
    pagination: PaginationState

    /** The full API response for access to raw data if needed */
    rawResponse: TransactionHistoryResponse

    /**
     * Function to fetch the next page of results.
     * Returns null if there is no next page (you're at the end).
     * This is a convenience method that uses the nextUrl from the response.
     */
    getNextPage: () => Promise<PaginatedTransactionResult | null>

    /**
     * Function to fetch the previous page of results.
     * Returns null if there is no previous page (you're at the beginning).
     * This is a convenience method that uses the previousUrl from the response.
     */
    getPreviousPage: () => Promise<PaginatedTransactionResult | null>
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * Custom error class for transaction history API errors.
 *
 * Provides additional context about what went wrong during the API call.
 */
export class TransactionHistoryError extends Error {
    /**
     * HTTP status code if the request failed with an HTTP error.
     * Example: 404 (not found), 429 (rate limited), 500 (server error)
     */
    public statusCode?: number

    /**
     * The URL that was being fetched when the error occurred.
     * Useful for debugging which endpoint failed.
     */
    public url?: string

    /**
     * The original error that caused this failure.
     * Could be a network error, JSON parse error, etc.
     */
    public originalError?: Error

    constructor(
        message: string,
        statusCode?: number,
        url?: string,
        originalError?: Error,
    ) {
        super(message)
        this.name = 'TransactionHistoryError'
        this.statusCode = statusCode
        this.url = url
        this.originalError = originalError
    }
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Builds the query string from the provided parameters.
 *
 * This helper function converts the parameter object into a URL-encoded
 * query string that can be appended to the URL.
 *
 * @param params - The parameters object containing optional query parameters
 * @returns A URL-encoded query string (without the leading "?")
 *
 * Example:
 * Input: { assetId: 31566704, limit: 25 }
 * Output: "asset_id=31566704&limit=25"
 */
function buildQueryString(
    params: Partial<GetTransactionHistoryParams>,
): string {
    // Create a URLSearchParams object which handles URL encoding automatically
    const searchParams = new URLSearchParams()

    // Add asset_id parameter if provided
    // Note: We convert camelCase (assetId) to snake_case (asset_id) as expected by the API
    if (params.assetId !== undefined) {
        searchParams.append('asset_id', params.assetId.toString())
    }

    // Add after_time parameter if provided
    // This should be an ISO 8601 timestamp string
    if (params.afterTime !== undefined) {
        searchParams.append('after_time', params.afterTime)
    }

    // Add before_time parameter if provided
    if (params.beforeTime !== undefined) {
        searchParams.append('before_time', params.beforeTime)
    }

    // Add limit parameter if provided, otherwise use the default
    // We always include limit to ensure consistent pagination behavior
    searchParams.append(
        'limit',
        (params.limit ?? DEFAULT_ITEMS_PER_PAGE).toString(),
    )

    // Convert to string - URLSearchParams automatically handles encoding
    // This will be empty string if no params were added
    return searchParams.toString()
}

/**
 * Fetches transaction history for a given account.
 *
 * This is the main entry point for fetching transactions. It handles the initial
 * request to get the first page of results with optional filtering.
 *
 * @param params - The parameters for the request including account address and filters
 * @returns A PaginatedTransactionResult containing the transactions and pagination helpers
 * @throws TransactionHistoryError if the request fails
 *
 * Example usage:
 * ```typescript
 * const result = await getTransactionHistory({
 *   accountAddress: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ",
 *   limit: 25
 * });
 * console.log(`Fetched ${result.transactions.length} transactions`);
 *
 * // Fetch next page
 * const nextPage = await result.getNextPage();
 * ```
 */
export async function getTransactionHistory(
    params: GetTransactionHistoryParams,
): Promise<PaginatedTransactionResult> {
    // Build the base endpoint URL
    // The endpoint pattern is: /v1/accounts/{account_address}/transactions/
    const endpoint = `/v1/accounts/${encodeURIComponent(params.accountAddress)}/transactions/`

    // Build the query string from filter parameters
    // We destructure to get the query params excluding accountAddress
    const { accountAddress, ...queryParams } = params
    const queryString = buildQueryString(queryParams)

    // Construct the full URL by combining base URL, endpoint, and query string
    // Only add "?" if there are query parameters
    const url = `${PERA_API_BASE_URL}${endpoint}${queryString ? `?${queryString}` : ''}`

    // Call the internal fetch function to make the actual HTTP request
    return fetchTransactions(url, params.accountAddress)
}

/**
 * Fetches more transactions using a pagination URL.
 *
 * Use this function when you have a nextUrl or previousUrl from a previous
 * response and want to fetch that specific page.
 *
 * @param params - Object containing the URL to fetch
 * @param accountAddress - The account address (for reference in the result)
 * @returns A PaginatedTransactionResult containing the transactions and pagination helpers
 * @throws TransactionHistoryError if the request fails
 *
 * Example usage:
 * ```typescript
 * // After getting initial results with nextUrl
 * const moreResults = await getMoreTransactions({
 *   url: result.pagination.nextUrl!
 * }, accountAddress);
 * ```
 */
export async function getMoreTransactions(
    params: GetMoreTransactionsParams,
    accountAddress: string,
): Promise<PaginatedTransactionResult> {
    // Simply delegate to the internal fetch function with the provided URL
    // The URL should already be complete (including base URL and all params)
    return fetchTransactions(params.url, accountAddress)
}

/**
 * Internal function that performs the actual HTTP fetch and processes the response.
 *
 * This function handles:
 * - Making the HTTP GET request
 * - Checking for HTTP errors
 * - Parsing the JSON response
 * - Creating pagination state
 * - Setting up pagination helper functions
 *
 * @param url - The full URL to fetch
 * @param accountAddress - The account address for context
 * @returns A PaginatedTransactionResult with all data and helpers
 * @throws TransactionHistoryError on any failure
 */
async function fetchTransactions(
    url: string,
    accountAddress: string,
): Promise<PaginatedTransactionResult> {
    try {
        // Make the HTTP GET request using native fetch API
        // fetch returns a Promise that resolves to a Response object
        const response = await fetch(url, {
            method: 'GET', // HTTP GET method for retrieving data
            headers: {
                // Set Accept header to indicate we expect JSON response
                Accept: 'application/json',
                // Set Content-Type for consistency (though not strictly needed for GET)
                'Content-Type': 'application/json',
            },
        })

        // Check if the HTTP response indicates an error
        // response.ok is true for status codes 200-299
        // If not ok, throw an error with the status code
        if (!response.ok) {
            throw new TransactionHistoryError(
                `HTTP error! Status: ${response.status} - ${response.statusText}`,
                response.status,
                url,
            )
        }

        // Parse the JSON body of the response
        // response.json() returns a Promise that resolves to the parsed JavaScript object
        const data: TransactionHistoryResponse = await response.json()

        // Create the pagination state object based on the response
        // This tracks whether we can navigate forward or backward
        const paginationState: PaginationState = {
            hasNextPage: data.next !== null, // True if there's a next URL
            hasPreviousPage: data.previous !== null, // True if there's a previous URL
            nextUrl: data.next, // URL for next page or null
            previousUrl: data.previous, // URL for previous page or null
            totalFetched: data.results.length, // Count of transactions in this response
        }

        // Create the result object with convenience methods for pagination
        const result: PaginatedTransactionResult = {
            // The array of transaction items from the response
            transactions: data.results,

            // The pagination state we just created
            pagination: paginationState,

            // Store the full raw response for direct access if needed
            rawResponse: data,

            // Convenience method to fetch the next page
            // Returns null if there's no next page, otherwise calls getMoreTransactions
            getNextPage: async () => {
                // Check if there's a next page available
                if (!data.next) {
                    return null // No next page, return null
                }
                // Recursively call getMoreTransactions with the next URL
                return getMoreTransactions({ url: data.next }, accountAddress)
            },

            // Convenience method to fetch the previous page
            // Returns null if there's no previous page, otherwise calls getMoreTransactions
            getPreviousPage: async () => {
                // Check if there's a previous page available
                if (!data.previous) {
                    return null // No previous page, return null
                }
                // Recursively call getMoreTransactions with the previous URL
                return getMoreTransactions(
                    { url: data.previous },
                    accountAddress,
                )
            },
        }

        // Return the fully constructed result
        return result
    } catch (error) {
        // Error handling - catch any errors that occurred during fetch or parsing

        // If it's already our custom error type, just re-throw it
        if (error instanceof TransactionHistoryError) {
            throw error
        }

        // If it's a network error or other Error type, wrap it in our custom error
        if (error instanceof Error) {
            throw new TransactionHistoryError(
                `Failed to fetch transaction history: ${error.message}`,
                undefined, // No HTTP status code since request didn't complete
                url,
                error,
            )
        }

        // For unknown error types, create a generic error
        throw new TransactionHistoryError(
            'An unknown error occurred while fetching transaction history',
            undefined,
            url,
            error instanceof Error ? error : undefined,
        )
    }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Fetches all transactions for an account by paginating through all pages.
 *
 * WARNING: This can make many API requests for accounts with lots of transactions.
 * Use with caution and consider implementing rate limiting or timeout logic.
 *
 * @param params - The initial parameters (filters, etc.)
 * @param maxPages - Maximum number of pages to fetch (default: 10)
 * @returns Array of all transactions across all fetched pages
 * @throws TransactionHistoryError if any request fails
 */
export async function getAllTransactions(
    params: GetTransactionHistoryParams,
    maxPages: number = 10,
): Promise<TransactionHistoryItemResponse[]> {
    // Array to accumulate all transactions
    const allTransactions: TransactionHistoryItemResponse[] = []

    // Fetch the first page
    let currentResult = await getTransactionHistory(params)

    // Add first page transactions to our accumulator
    allTransactions.push(...currentResult.transactions)

    // Track how many pages we've fetched
    let pageCount = 1

    // Continue fetching next pages while they exist and we haven't hit maxPages
    while (currentResult.pagination.hasNextPage && pageCount < maxPages) {
        // Fetch the next page using the convenience method
        const nextResult = await currentResult.getNextPage()

        // If nextResult is null, we've reached the end
        if (!nextResult) {
            break
        }

        // Add the new transactions to our accumulator
        allTransactions.push(...nextResult.transactions)

        // Update currentResult for the next iteration
        currentResult = nextResult

        // Increment page counter
        pageCount++
    }

    // Return all accumulated transactions
    return allTransactions
}

/**
 * Converts microAlgos to ALGOs with proper decimal formatting.
 *
 * Algorand uses microAlgos as its base unit (1 ALGO = 1,000,000 microAlgos).
 * This helper converts string microAlgo amounts to human-readable ALGO amounts.
 *
 * @param microAlgos - The amount in microAlgos as a string
 * @param decimals - Number of decimal places to show (default: 6)
 * @returns The amount in ALGOs as a formatted string
 *
 * Example:
 * formatMicroAlgos("1000000") // Returns "1.000000"
 * formatMicroAlgos("1500000", 2) // Returns "1.50"
 */
export function formatMicroAlgos(
    microAlgos: string,
    decimals: number = 6,
): string {
    // Parse the microAlgo amount as a BigInt to avoid precision loss
    const amount = BigInt(microAlgos)

    // Convert to ALGOs by dividing by 1,000,000
    const algoAmount = Number(amount) / 1_000_000

    // Format with specified decimal places
    return algoAmount.toFixed(decimals)
}

/**
 * Converts Unix timestamp to JavaScript Date object.
 *
 * The API returns Unix timestamps in seconds, but JavaScript Date
 * expects milliseconds since epoch.
 *
 * @param unixTimestamp - Unix timestamp in seconds
 * @returns JavaScript Date object
 */
export function parseRoundTime(unixTimestamp: number): Date {
    // Multiply by 1000 to convert seconds to milliseconds
    return new Date(unixTimestamp * 1000)
}

// =============================================================================
// EXAMPLE USAGE
// =============================================================================

/**
 * Example: Basic usage of the transaction history API
 *
 * This example demonstrates how to:
 * 1. Fetch the first page of transactions
 * 2. Check pagination state
 * 3. Fetch subsequent pages
 */
async function exampleBasicUsage() {
    try {
        // Fetch first page of transactions
        const result = await getTransactionHistory({
            accountAddress:
                'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
            limit: 25,
        })

        // Log the transactions
        console.log(`Fetched ${result.transactions.length} transactions`)

        // Log each transaction
        result.transactions.forEach(tx => {
            const date = parseRoundTime(tx.round_time)
            console.log(`${tx.id}: ${tx.tx_type} at ${date.toISOString()}`)
        })

        // Check if there are more pages
        if (result.pagination.hasNextPage) {
            console.log(
                `More transactions available at: ${result.pagination.nextUrl}`,
            )

            // Fetch next page
            const nextPage = await result.getNextPage()
            if (nextPage) {
                console.log(
                    `Fetched ${nextPage.transactions.length} more transactions`,
                )
            }
        }
    } catch (error) {
        if (error instanceof TransactionHistoryError) {
            console.error(`Error fetching transactions: ${error.message}`)
            console.error(`Status code: ${error.statusCode}`)
            console.error(`URL: ${error.url}`)
        } else {
            console.error(`Unexpected error: ${error}`)
        }
    }
}

/**
 * Example: Fetching transactions for a specific asset
 *
 * This example shows how to filter transactions to only show
 * those involving a specific ASA (Algorand Standard Asset).
 */
async function exampleAssetFiltering() {
    try {
        // Fetch only USDC transactions (Asset ID: 31566704)
        const result = await getTransactionHistory({
            accountAddress:
                'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
            assetId: 31566704, // USDC on Algorand
            limit: 25,
        })

        console.log(`Fetched ${result.transactions.length} USDC transactions`)

        // Log details of each transfer
        result.transactions.forEach(tx => {
            if (tx.asset) {
                const amount =
                    Number(tx.amount) / Math.pow(10, tx.asset.decimals)
                console.log(
                    `${tx.asset.unitName}: ${amount} at round ${tx.confirmed_round}`,
                )
            }
        })
    } catch (error) {
        console.error(`Error: ${error}`)
    }
}

/**
 * Example: Date range filtering
 *
 * This example demonstrates how to filter transactions by date range.
 */
async function exampleDateRangeFiltering() {
    try {
        // Create date range for the last 30 days
        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

        // Convert to ISO 8601 format
        const afterTime = thirtyDaysAgo.toISOString() // "2024-01-01T00:00:00.000Z"
        const beforeTime = now.toISOString()

        // Fetch transactions within date range
        const result = await getTransactionHistory({
            accountAddress:
                'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
            afterTime: afterTime,
            beforeTime: beforeTime,
            limit: 50,
        })

        console.log(
            `Fetched ${result.transactions.length} transactions from last 30 days`,
        )
    } catch (error) {
        console.error(`Error: ${error}`)
    }
}

/**
 * Example: Complete pagination with manual control
 *
 * This example shows how to manually control pagination
 * for advanced use cases.
 */
async function exampleManualPagination() {
    const accountAddress =
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'
    const allTransactions: TransactionHistoryItemResponse[] = []

    // Fetch first page
    let currentPage = await getTransactionHistory({
        accountAddress,
        limit: 25,
    })

    // Add to accumulator
    allTransactions.push(...currentPage.transactions)
    console.log(`Page 1: ${currentPage.transactions.length} transactions`)

    // Fetch pages 2-5
    for (let page = 2; page <= 5; page++) {
        if (!currentPage.pagination.hasNextPage) {
            console.log(`No more pages after page ${page - 1}`)
            break
        }

        // Use getMoreTransactions with the nextUrl for explicit control
        currentPage = await getMoreTransactions(
            { url: currentPage.pagination.nextUrl! },
            accountAddress,
        )

        allTransactions.push(...currentPage.transactions)
        console.log(
            `Page ${page}: ${currentPage.transactions.length} transactions`,
        )
    }

    console.log(`Total fetched: ${allTransactions.length} transactions`)
}

// Export all types and functions for use in other modules
export { PERA_API_BASE_URL, DEFAULT_ITEMS_PER_PAGE, buildQueryString }
