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

import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import type { ErrorMessageKeys } from '@perawallet/wallet-core-shared'

/**
 * Stable codes identifying a translated algod/indexer error.
 *
 * Each code maps 1:1 to its copy in {@link ALGOD_ERROR_MESSAGE_KEYS}. When
 * adding a new code, add the matching regex to {@link ./parseAlgodMessage.ts},
 * the params shape to {@link AlgodErrorParamsByCode}, its keys to
 * {@link ALGOD_ERROR_MESSAGE_KEYS}, and the translation strings to the mobile
 * `en.json`.
 */
export const AlgodErrorCode = {
    /** Sender's ALGO balance minus spend falls below what the account can cover. */
    OVERSPEND: 'overspend',
    /** Sender's ALGO balance would drop below its MBR after the transaction. */
    BELOW_MIN_BALANCE: 'below_min_balance',
    /** An account involved in an asset transfer is not opted into the asset. */
    MISSING_OPT_IN: 'missing_opt_in',
    /** The asset holding is frozen for an account in the transfer. */
    ASSET_FROZEN: 'asset_frozen',
    /** Transaction was already committed to the ledger. */
    DUPLICATE_TXN: 'duplicate_txn',
    /** Transaction's validity window has passed or is in the future. */
    EXPIRED_TXN: 'expired_txn',
    /**
     * Transaction signed with a key that is not the sender's current auth
     * address — typically an externally-rekeyed account the wallet hasn't
     * synced yet.
     */
    NOT_AUTHORIZED: 'not_authorized',
    /** Smart-contract TEAL assertion failure. Delegated from algokit's LogicError. */
    LOGIC_ERROR: 'logic_error',
    /** App-call TEAL rejection reported by the node (assert/err/opcode failures). */
    LOGIC_EVAL_ERROR: 'logic_eval_error',
    /** App call referenced an account/asset/app/box that was not made available. */
    UNAVAILABLE_RESOURCE: 'unavailable_resource',
    /** Atomic group's pooled fees fall short of the required minimum. */
    GROUP_FEE_TOO_SMALL: 'group_fee_too_small',
    /** Network/transport error — node unreachable, 5xx, fetch failed, timeout. */
    NETWORK_UNAVAILABLE: 'network_unavailable',
    /** Fallback: node returned an error we don't have a translation for yet. */
    UNKNOWN_NODE_ERROR: 'unknown_node_error',
} as const

export type AlgodErrorCode =
    (typeof AlgodErrorCode)[keyof typeof AlgodErrorCode]

/**
 * Title and body copy for each code. `network_unavailable` shares the
 * offline copy with `PeraNetworkError`'s `offline` kind.
 */
export const ALGOD_ERROR_MESSAGE_KEYS: Record<
    AlgodErrorCode,
    ErrorMessageKeys
> = {
    overspend: {
        titleKey: i18nKey('errors.algod.overspend.title'),
        bodyKey: i18nKey('errors.algod.overspend.body'),
    },
    below_min_balance: {
        titleKey: i18nKey('errors.algod.below_min_balance.title'),
        bodyKey: i18nKey('errors.algod.below_min_balance.body'),
    },
    missing_opt_in: {
        titleKey: i18nKey('errors.algod.missing_opt_in.title'),
        bodyKey: i18nKey('errors.algod.missing_opt_in.body'),
    },
    asset_frozen: {
        titleKey: i18nKey('errors.transaction.asset_frozen.title'),
        bodyKey: i18nKey('errors.transaction.asset_frozen.body'),
    },
    duplicate_txn: {
        titleKey: i18nKey('errors.algod.duplicate_txn.title'),
        bodyKey: i18nKey('errors.algod.duplicate_txn.body'),
    },
    expired_txn: {
        titleKey: i18nKey('errors.algod.expired_txn.title'),
        bodyKey: i18nKey('errors.algod.expired_txn.body'),
    },
    not_authorized: {
        titleKey: i18nKey('errors.algod.not_authorized.title'),
        bodyKey: i18nKey('errors.algod.not_authorized.body'),
    },
    logic_error: {
        titleKey: i18nKey('errors.algod.logic_error.title'),
        bodyKey: i18nKey('errors.algod.logic_error.body'),
    },
    logic_eval_error: {
        titleKey: i18nKey('errors.algod.logic_eval_error.title'),
        bodyKey: i18nKey('errors.algod.logic_eval_error.body'),
    },
    unavailable_resource: {
        titleKey: i18nKey('errors.algod.unavailable_resource.title'),
        bodyKey: i18nKey('errors.algod.unavailable_resource.body'),
    },
    group_fee_too_small: {
        titleKey: i18nKey('errors.algod.group_fee_too_small.title'),
        bodyKey: i18nKey('errors.algod.group_fee_too_small.body'),
    },
    network_unavailable: {
        titleKey: i18nKey('errors.network.no_connection.title'),
        bodyKey: i18nKey('errors.network.no_connection.body'),
    },
    unknown_node_error: {
        titleKey: i18nKey('errors.algod.unknown_node_error.title'),
        bodyKey: i18nKey('errors.algod.unknown_node_error.body'),
    },
}

/**
 * Shape of the typed `params` object carried by an AlgodError, discriminated
 * by {@link AlgodErrorCode}. Values are kept at node fidelity (bigint for
 * microAlgo amounts and asset IDs) and converted to display units at the UI
 * boundary.
 */
export interface AlgodErrorParamsByCode {
    // No balance/spent/missing fields: the node's overspend message renders a
    // fee-adjusted figure that cannot be parsed back into a real balance. See
    // conformance/README.md and `parseAlgodMessage.ts`'s `OVERSPEND_RE`
    // comment for the full reasoning.
    overspend: {
        address: string
    }
    below_min_balance: {
        address: string
        balance: bigint
        required: bigint
        assetCount?: number
    }
    missing_opt_in: {
        address: string
        assetId: bigint
    }
    asset_frozen: {
        address: string
        assetId: bigint
    }
    duplicate_txn: {
        txId: string
    }
    expired_txn: {
        lastValid?: bigint
        currentRound?: bigint
    }
    not_authorized: {
        /** The sender's current on-chain auth address. */
        expectedAuthAddress: string
        /** The address whose key actually signed. */
        actualAuthAddress: string
    }
    logic_error: {
        txId?: string
        pc?: number
        msg: string
        tealLine?: number
    }
    logic_eval_error: {
        /** Failing app id when the node includes `Details: app=N`. */
        appId?: bigint
        /** The eval failure reason, e.g. "assert failed pc=1234". */
        detail: string
    }
    unavailable_resource: {
        resourceType: 'Account' | 'Asset' | 'App' | 'Box'
        resource: string
    }
    // No paid/required fields: algod 5.0.0-stable renders both in a scaled,
    // variable-suffix unit that cannot be parsed back into a microAlgo count.
    // Same reasoning as `overspend` above.
    group_fee_too_small: Record<string, never>
    network_unavailable: {
        status?: number
        url?: string
    }
    unknown_node_error: {
        raw: string
    }
}
