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

// MSW handler factories for algod / indexer REST endpoints.
//
// algokit-utils makes HTTP calls under the hood (verified to be MSW-
// interceptable in apps/mobile/src/__integration__/algokit-smoke.test.ts).
// These factories cover the endpoints the app exercises most often. The
// path globs (`*\/v2/...`) match both algonode hosts (mainnet vs testnet)
// so handlers don't need to know which network the test runs against.
//
// algod and indexer share several path shapes (e.g. `/v2/accounts/{addr}`).
// MSW resolves handlers in registration order — register the more specific
// handler first if both are needed in the same test.

import { http, HttpResponse, type HttpHandler } from 'msw'

// algod and indexer responses are NOT validated by zod schemas in this
// repo — algokit-utils owns the schema layer for those (it parses every
// response into typed model classes via `decodeJson` + per-field codecs).
// The shapes below mirror algokit's wire-format expectations; if algokit
// is upgraded and the response shape drifts, the typed client will refuse
// our mocked JSON at parse time — the same failure mode the reviewer
// flagged for our Pera REST mocks. We keep the types local so this file
// doesn't pull algokit's internal codec types into a public surface.

// ---------------------------------------------------------------------------
// algod
// ---------------------------------------------------------------------------

/**
 * Shape of the algod `GET /v2/accounts/{address}` response. Exposed loosely
 * so tests can pass partial fixtures and let the type system stay honest.
 */
export type AlgodAccountInformationResponse = {
    address: string
    amount: number
    'min-balance': number
    'amount-without-pending-rewards'?: number
    'pending-rewards'?: number
    rewards?: number
    round?: number
    status?: 'Offline' | 'Online' | 'NotParticipating'
    /**
     * Chain-side rekey indicator. When present, it's the address that
     * currently has signing authority for `address`. The wallet's
     * `fetchAndPersistAccount` reads this and overwrites the local
     * `account.rekeyAddress` so the wallet's rekey state stays in sync
     * with the chain — tests covering rekeyed accounts MUST set this
     * to the auth address or the wallet will silently un-rekey.
     */
    'auth-addr'?: string
    assets?: Array<{
        'asset-id': number
        amount: number
        'is-frozen': boolean
    }>
    'created-assets'?: unknown[]
    'apps-local-state'?: unknown[]
    'created-apps'?: unknown[]
    'apps-total-schema'?: { 'num-byte-slice': number; 'num-uint': number }
    'total-apps-opted-in'?: number
    'total-assets-opted-in'?: number
    'total-created-apps'?: number
    'total-created-assets'?: number
}

const DEFAULT_EMPTY_ACCOUNT: Omit<AlgodAccountInformationResponse, 'address'> =
    {
        amount: 0,
        'min-balance': 100_000,
        'amount-without-pending-rewards': 0,
        'pending-rewards': 0,
        rewards: 0,
        round: 1,
        status: 'Offline',
        assets: [],
        'created-assets': [],
        'apps-local-state': [],
        'created-apps': [],
        'apps-total-schema': { 'num-byte-slice': 0, 'num-uint': 0 },
        'total-apps-opted-in': 0,
        'total-assets-opted-in': 0,
        'total-created-apps': 0,
        'total-created-assets': 0,
    }

export type MockAlgodAccountInformationParams = {
    address: string
    response: Partial<AlgodAccountInformationResponse>
    status?: number
}

/**
 * MSW factory for algod `GET /v2/accounts/{address}`. Merges `response` over
 * `DEFAULT_EMPTY_ACCOUNT`, so pass only the fields the test cares about
 * (`amount`, `min-balance`, `auth-addr`).
 *
 * @example Quantum account with a balance (compose with quantumAccountFixtures):
 * server.use(
 *     mockAlgodAccountInformation({
 *         address: QUANTUM_TEST_ADDRESS,
 *         response: { amount: 5_000_000, 'min-balance': 100_000 },
 *     }),
 * )
 */
export const mockAlgodAccountInformation = ({
    address,
    response,
    status = 200,
}: MockAlgodAccountInformationParams): HttpHandler =>
    http.get(`*/v2/accounts/${address}`, () =>
        HttpResponse.json(
            { ...DEFAULT_EMPTY_ACCOUNT, address, ...response },
            { status },
        ),
    )

export type AlgodTransactionParamsResponse = {
    'consensus-version': string
    fee: number
    'min-fee': number
    'genesis-id': string
    'genesis-hash': string
    'last-round': number
}

const DEFAULT_TX_PARAMS: AlgodTransactionParamsResponse = {
    'consensus-version': 'test',
    fee: 0,
    'min-fee': 1000,
    'genesis-id': 'mainnet-v1.0',
    'genesis-hash': 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
    'last-round': 1,
}

export type MockAlgodTransactionParamsParams = {
    response?: Partial<AlgodTransactionParamsResponse>
    status?: number
}

export const mockAlgodTransactionParams = ({
    response,
    status = 200,
}: MockAlgodTransactionParamsParams = {}): HttpHandler =>
    http.get('*/v2/transactions/params', () =>
        HttpResponse.json({ ...DEFAULT_TX_PARAMS, ...response }, { status }),
    )

export type MockAlgodSendRawTransactionParams = {
    /** Transaction id to return for a successful submission. Defaults to a
     *  fixed test value. */
    txId?: string
    status?: number
}

export const mockAlgodSendRawTransaction = ({
    txId = 'TESTTXID0000000000000000000000000000000000000000000000',
    status = 200,
}: MockAlgodSendRawTransactionParams = {}): HttpHandler =>
    http.post('*/v2/transactions', () =>
        HttpResponse.json({ txId }, { status }),
    )

export type AlgodAccountAssetInformationResponse = {
    'asset-holding': {
        amount: number
        'asset-id': number
        'is-frozen': boolean
    }
    round?: number
}

export type MockAlgodAccountAssetInformationParams = {
    address: string
    assetId: number | string
    response: AlgodAccountAssetInformationResponse
    status?: number
}

export const mockAlgodAccountAssetInformation = ({
    address,
    assetId,
    response,
    status = 200,
}: MockAlgodAccountAssetInformationParams): HttpHandler =>
    http.get(`*/v2/accounts/${address}/assets/${assetId}`, () =>
        HttpResponse.json(response, { status }),
    )

export type MockAlgodStatusParams = {
    response?: { 'last-round': number }
    status?: number
}

export const mockAlgodStatus = ({
    response = { 'last-round': 1 },
    status = 200,
}: MockAlgodStatusParams = {}): HttpHandler =>
    http.get('*/v2/status', () => HttpResponse.json(response, { status }))

export type MockAlgodTealCompileParams = {
    /** Base64-encoded compiled program bytes (algod's `result` field). */
    result?: string
    /** Program address hash (algod's `hash` field). */
    hash?: string
    status?: number
}

// algod `POST /v2/teal/compile` — returns `{ hash, result }` where `result` is
// the base64 compiled program. Default `result` is base64 of `[0x06,0x81,0x01]`
// (`#pragma version 6; int 1`).
export const mockAlgodTealCompile = ({
    result = 'BoEB',
    hash = 'MOCKPROGRAMHASHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    status = 200,
}: MockAlgodTealCompileParams = {}): HttpHandler =>
    http.post('*/v2/teal/compile', () =>
        HttpResponse.json({ hash, result }, { status }),
    )

// ---------------------------------------------------------------------------
// indexer
// ---------------------------------------------------------------------------

export type IndexerAccountTransactionsResponse = {
    transactions: unknown[]
    'next-token'?: string
    'current-round': number
}

export type MockIndexerAccountTransactionsParams = {
    address: string
    response: Partial<IndexerAccountTransactionsResponse>
    status?: number
}

export const mockIndexerAccountTransactions = ({
    address,
    response,
    status = 200,
}: MockIndexerAccountTransactionsParams): HttpHandler =>
    http.get(`*/v2/accounts/${address}/transactions`, () =>
        HttpResponse.json(
            {
                transactions: [],
                'current-round': 1,
                ...response,
            },
            { status },
        ),
    )

export type MockIndexerAccountParams = {
    address: string
    response: Partial<AlgodAccountInformationResponse>
    status?: number
}

// Indexer's GET /v2/accounts/{address} returns the same shape as algod with
// an extra `current-round` wrapper. Same path; tests rendering fixtures via
// the indexer client should use this instead of the algod variant.
export const mockIndexerAccount = ({
    address,
    response,
    status = 200,
}: MockIndexerAccountParams): HttpHandler =>
    http.get(`*/v2/accounts/${address}`, () =>
        HttpResponse.json(
            {
                'current-round': 1,
                account: { ...DEFAULT_EMPTY_ACCOUNT, address, ...response },
            },
            { status },
        ),
    )

export type MockIndexerAssetParams = {
    assetId: number | string
    response: { params: Record<string, unknown>; index: number }
    status?: number
}

export const mockIndexerAsset = ({
    assetId,
    response,
    status = 200,
}: MockIndexerAssetParams): HttpHandler =>
    http.get(`*/v2/assets/${assetId}`, () =>
        HttpResponse.json({ 'current-round': 1, asset: response }, { status }),
    )

// Indexer's GET /v2/accounts (no path param) is the search endpoint
// (`searchForAccounts`). The query string carries filters like `auth-addr`,
// which `discoverRekeyedAccounts` uses to find addresses that have rekeyed
// to a candidate. The path glob is distinct from `*/v2/accounts/{address}`
// — MSW does no prefix matching, so the two handlers don't collide.
export type IndexerSearchForAccountsResponse = {
    accounts: Array<{ address: string; [k: string]: unknown }>
    'current-round'?: number
    'next-token'?: string
}

export type MockIndexerSearchForAccountsParams = {
    response?: Partial<IndexerSearchForAccountsResponse>
    status?: number
}

export const mockIndexerSearchForAccounts = ({
    response,
    status = 200,
}: MockIndexerSearchForAccountsParams = {}): HttpHandler =>
    http.get('*/v2/accounts', () =>
        HttpResponse.json(
            { 'current-round': 1, accounts: [], ...response },
            { status },
        ),
    )
