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

// "overspend (account ADDR, data {...}, tried to spend ...)" — matched on
// shape only, not on how the balance/spend figures are rendered. go-algorand
// has used at least two incompatible formats for that rendering: an older
// raw-struct dump (`MicroAlgos:{Raw:199000}`, `tried to spend {201000}`,
// PERA-4038) and algod 5.0.0-stable's human-scaled, unit-suffixed rendering
// (`MicroAlgos:299.777mA`, `MicroAlgos:1.233567A`, `tried to spend 50A`,
// decimal digits and the unit itself both varying with magnitude). The
// balance figure additionally subtracts the transaction's own fee before
// display in the new format (confirmed empirically against LocalNet:
// rendered value = balance - fee), which the message text alone cannot
// invert. Neither figure is safely reconstructable from the string, so this
// classifies the rejection correctly without extracting numbers from either
// format — see `AlgodErrorParamsByCode.overspend` for why those params are
// optional and left unset.
const OVERSPEND_RE = new RegExp(
    `overspend \\(account (${ADDRESS}),.*?tried to spend`,
    's',
)

const matchOverspend: Matcher = message => {
    const m = OVERSPEND_RE.exec(message)
    if (!m) return null
    return {
        code: AlgodErrorCode.OVERSPEND,
        params: { address: m[1] },
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

// "asset N frozen in ADDR"
const ASSET_FROZEN_RE = new RegExp(`asset (\\d+) frozen in (${ADDRESS})`)

const matchAssetFrozen: Matcher = message => {
    const m = ASSET_FROZEN_RE.exec(message)
    if (!m) return null
    return {
        code: AlgodErrorCode.ASSET_FROZEN,
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
// go-algorand renders the round range with either one or two dashes
// depending on version (confirmed against LocalNet: algod 5.0.0-stable
// uses "outside of 1670--1675"); accept both rather than assuming either.
const EXPIRED_TXN_RE = /txn dead:\s*round (\d+) outside of (\d+)-{1,2}(\d+)/

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

// "unavailable Account ADDR" / "unavailable Asset N" / "unavailable App N"
const UNAVAILABLE_RESOURCE_RE =
    /unavailable (Account|Asset|App) ([A-Z2-7]{58}|\d+)/

const matchUnavailableResource: Matcher = message => {
    const m = UNAVAILABLE_RESOURCE_RE.exec(message)
    if (!m) return null
    return {
        code: AlgodErrorCode.UNAVAILABLE_RESOURCE,
        params: {
            resourceType: m[1] as 'Account' | 'Asset' | 'App',
            resource: m[2],
        },
    }
}

// "invalid Box reference 0x…" — the box-flavored unavailable-resource error
const INVALID_BOX_RE = /invalid Box reference (\S+?)\.?(?:\s|$)/

const matchInvalidBox: Matcher = message => {
    const m = INVALID_BOX_RE.exec(message)
    if (!m) return null
    return {
        code: AlgodErrorCode.UNAVAILABLE_RESOURCE,
        params: { resourceType: 'Box', resource: m[1] },
    }
}

// "logic eval error: REASON[. Details: app=N, pc=…]"
const LOGIC_EVAL_RE = /logic eval error:\s*(.+?)(?:\.\s*Details:|$)/s
const LOGIC_EVAL_APP_RE = /Details:.*?\bapp=(\d+)/s

const matchLogicEval: Matcher = message => {
    const m = LOGIC_EVAL_RE.exec(message)
    if (!m) return null
    const app = LOGIC_EVAL_APP_RE.exec(message)
    return {
        code: AlgodErrorCode.LOGIC_EVAL_ERROR,
        params: {
            appId: app ? BigInt(app[1]) : undefined,
            detail: m[1].trim(),
        },
    }
}

// "txgroup had N in fees, which is less than the minimum … M[)]"
const GROUP_FEE_RE =
    /had (\d+) in fees, which is less than the minimum.*?(\d+)\)?\s*$/s

const matchGroupFeeTooSmall: Matcher = message => {
    const m = GROUP_FEE_RE.exec(message)
    if (!m) return null
    return {
        code: AlgodErrorCode.GROUP_FEE_TOO_SMALL,
        params: { paid: BigInt(m[1]), required: BigInt(m[2]) },
    }
}

// Order matters only in the sense that each matcher is independent and
// returns on first hit — overspend must come before below_min_balance since
// overspend messages contain the address pattern too. unavailable/box must
// come before logic-eval since "unavailable ..." and "invalid Box ..."
// messages are themselves prefixed with "logic eval error:"; logic-eval is
// last because it is the broadest match.
const MATCHERS: readonly Matcher[] = [
    matchOverspend,
    matchBelowMinBalance,
    matchMissingOptIn,
    matchAssetFrozen,
    matchDuplicateTxn,
    matchExpiredTxn,
    matchNotAuthorized,
    matchUnavailableResource,
    matchInvalidBox,
    matchGroupFeeTooSmall,
    matchLogicEval,
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
