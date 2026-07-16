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

import { AlgodErrorCode, type AlgodErrorParamsByCode } from './algodErrorCodes'

/**
 * Result of attempting to parse a raw algod error message.
 * Discriminated by {@link AlgodErrorCode}. `null` = message didn't match any
 * known pattern; caller should fall back to `unknown_node_error`.
 */
export type ParsedAlgodMessage = {
    [C in keyof AlgodErrorParamsByCode]: {
        code: C
        params: AlgodErrorParamsByCode[C]
    }
}[keyof AlgodErrorParamsByCode]

type Matcher = (message: string) => ParsedAlgodMessage | null

const ADDRESS = '[A-Z2-7]{58}'
const TXID = '[A-Z0-9]{52}'

// "overspend (account ADDR, data {... MicroAlgos:{Raw:N} ... }, tried to spend {M})"
const OVERSPEND_RE = new RegExp(
    `overspend \\(account (${ADDRESS}),.*?MicroAlgos:\\{Raw:(\\d+)\\}.*?tried to spend \\{(\\d+)\\}`,
    's',
)

const matchOverspend: Matcher = message => {
    const m = OVERSPEND_RE.exec(message)
    if (!m) return null
    const balance = BigInt(m[2])
    const spent = BigInt(m[3])
    return {
        code: AlgodErrorCode.OVERSPEND,
        params: {
            address: m[1],
            balance,
            spent,
            missing: spent > balance ? spent - balance : 0n,
        },
    }
}

// "account ADDR balance N below min M[ (K assets)]"
const BELOW_MIN_BALANCE_RE = new RegExp(
    `account (${ADDRESS}) balance (\\d+) below min (\\d+)(?: \\((\\d+) assets?\\))?`,
)

const matchBelowMinBalance: Matcher = message => {
    const m = BELOW_MIN_BALANCE_RE.exec(message)
    if (!m) return null
    const params: AlgodErrorParamsByCode['below_min_balance'] = {
        address: m[1],
        balance: BigInt(m[2]),
        required: BigInt(m[3]),
    }
    if (m[4] !== undefined) params.assetCount = Number(m[4])
    return { code: AlgodErrorCode.BELOW_MIN_BALANCE, params }
}

// "asset N missing from ADDR"
const MISSING_OPT_IN_RE = new RegExp(`asset (\\d+) missing from (${ADDRESS})`)

const matchMissingOptIn: Matcher = message => {
    const m = MISSING_OPT_IN_RE.exec(message)
    if (!m) return null
    return {
        code: AlgodErrorCode.MISSING_OPT_IN,
        params: {
            address: m[2],
            assetId: BigInt(m[1]),
        },
    }
}

// "transaction already in ledger: TXID"
const DUPLICATE_TXN_RE = new RegExp(
    `transaction already in ledger:\\s*(${TXID})`,
)

const matchDuplicateTxn: Matcher = message => {
    const m = DUPLICATE_TXN_RE.exec(message)
    if (!m) return null
    return {
        code: AlgodErrorCode.DUPLICATE_TXN,
        params: { txId: m[1] },
    }
}

// "should have been authorized by ADDR but was actually authorized by ADDR"
// — the node's rejection when the signing key is not the sender's current
// auth address (e.g. an external rekey the wallet hasn't synced yet).
const NOT_AUTHORIZED_RE = new RegExp(
    `should have been authorized by (${ADDRESS}) but was actually authorized by (${ADDRESS})`,
)

const matchNotAuthorized: Matcher = message => {
    const m = NOT_AUTHORIZED_RE.exec(message)
    if (!m) return null
    return {
        code: AlgodErrorCode.NOT_AUTHORIZED,
        params: {
            expectedAuthAddress: m[1],
            actualAuthAddress: m[2],
        },
    }
}

// "txn dead: round N outside of A-B" — B is lastValid, N is current round
const EXPIRED_TXN_RE = /txn dead:\s*round (\d+) outside of (\d+)-(\d+)/

const matchExpiredTxn: Matcher = message => {
    const m = EXPIRED_TXN_RE.exec(message)
    if (!m) return null
    return {
        code: AlgodErrorCode.EXPIRED_TXN,
        params: {
            currentRound: BigInt(m[1]),
            lastValid: BigInt(m[3]),
        },
    }
}

// Order matters only in the sense that each matcher is independent and
// returns on first hit — overspend must come before below_min_balance since
// overspend messages contain the address pattern too.
const MATCHERS: readonly Matcher[] = [
    matchOverspend,
    matchBelowMinBalance,
    matchMissingOptIn,
    matchDuplicateTxn,
    matchExpiredTxn,
    matchNotAuthorized,
]

/**
 * Parses a raw algod error string into a structured code + params.
 *
 * Returns `null` when the message doesn't match any known pattern. Never
 * throws — a parse failure is always expressed as `null`.
 */
export const parseAlgodMessage = (
    message: string,
): ParsedAlgodMessage | null => {
    if (!message) return null
    for (const match of MATCHERS) {
        const result = match(message)
        if (result) return result
    }
    return null
}
