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

// MSW handler factories for algod / indexer REST endpoints. The path globs match
// both algonode hosts, so handlers needn't know which network a test runs on.
//
// algod and indexer share several path shapes (e.g. `/v2/accounts/{addr}`), and
// MSW resolves in registration order — register the more specific one first when
// a test needs both.

import { http, HttpResponse, type HttpHandler } from 'msw'
import { msgpackRawEncode } from 'algosdk'

// These responses aren't zod-validated here — algokit-utils owns that schema
// layer. The shapes below mirror its wire-format expectations, so an algokit
// upgrade that drifts will have the typed client refuse this mocked JSON at
// parse time. Kept local so algokit's internal codec types stay off our
// public surface.

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
     * `fetchAndPersistAccount` overwrites the local `account.rekeyAddress` from
     * this, so a test covering rekeyed accounts MUST set it — otherwise the
     * wallet silently un-rekeys.
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
 * Merges `response` over `DEFAULT_EMPTY_ACCOUNT`, so pass only the fields the
 * test cares about.
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

/**
 * The fields `waitForConfirmation` reads: a non-zero `confirmed-round` ends the
 * wait, a non-empty `pool-error` fails it. `message` carries algod's 404 body.
 */
export type AlgodPendingTransactionResponse = {
    'confirmed-round'?: number
    'pool-error'?: string
    message?: string
}

export type MockAlgodPendingTransactionParams = {
    /** Matches any txid when omitted — the shape a baseline handler wants. */
    txId?: string
    response?: AlgodPendingTransactionResponse
    status?: number
}

/**
 * What `waitForConfirmation` polls. Defaults to 404, not a confirmed round: its
 * job is keeping a fabricated txid off the network, and confirming would resolve
 * the wait and fire a refresh the test never asked for.
 *
 * algosdk requests this endpoint with `format=msgpack` and decodes the body as
 * a `PendingTransactionResponse`, so 2xx responses are msgpack-encoded here (a
 * JSON body silently decodes to an unconfirmed result and the wait never
 * ends). The model requires an inner signed transaction, so a minimal valid
 * `pay` stub is embedded — `waitForConfirmation` only reads
 * `confirmed-round` / `pool-error`. Error statuses stay JSON, matching algod.
 */
export const mockAlgodPendingTransaction = ({
    txId,
    response = { message: 'transaction not found' },
    status = 404,
}: MockAlgodPendingTransactionParams = {}): HttpHandler =>
    http.get(`*/v2/transactions/pending/${txId ?? ':txId'}`, () => {
        if (status < 200 || status >= 300) {
            return HttpResponse.json(response, { status })
        }
        const bytes = msgpackRawEncode({
            ...response,
            txn: {
                txn: {
                    type: 'pay',
                    snd: new Uint8Array(32),
                    fv: 1,
                    lv: 2,
                    gen: 'test-net',
                    gh: new Uint8Array(32),
                },
            },
        })
        return HttpResponse.arrayBuffer(
            bytes.buffer.slice(
                bytes.byteOffset,
                bytes.byteOffset + bytes.byteLength,
            ) as ArrayBuffer,
            {
                status,
                headers: { 'Content-Type': 'application/msgpack' },
            },
        )
    })

export type MockAlgodStatusAfterBlockParams = {
    /** Matches any round when omitted. */
    round?: number
    response?: { 'last-round': number }
    status?: number
}

// algod `GET /v2/status/wait-for-block-after/{round}` — the other half of
// waitForConfirmation's poll loop.
export const mockAlgodStatusAfterBlock = ({
    round,
    response = { 'last-round': 1 },
    status = 200,
}: MockAlgodStatusAfterBlockParams = {}): HttpHandler =>
    http.get(`*/v2/status/wait-for-block-after/${round ?? ':round'}`, () =>
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

// The indexer's search endpoint, whose query string carries filters like
// `auth-addr`. Its path glob is distinct from `*/v2/accounts/{address}` and MSW
// does no prefix matching, so the two handlers don't collide.
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
