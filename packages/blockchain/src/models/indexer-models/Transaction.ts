/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type { AccountStateDelta } from './AccountStateDelta.ts'
import type { StateDelta } from './StateDelta.ts'
import type { TransactionApplication } from './TransactionApplication.ts'
import type { TransactionAssetConfig } from './TransactionAssetConfig.ts'
import type { TransactionAssetFreeze } from './TransactionAssetFreeze.ts'
import type { TransactionAssetTransfer } from './TransactionAssetTransfer.ts'
import type { TransactionHeartbeat } from './TransactionHeartbeat.ts'
import type { TransactionKeyreg } from './TransactionKeyreg.ts'
import type { TransactionPayment } from './TransactionPayment.ts'
import type { TransactionSignature } from './TransactionSignature.ts'
import type { TransactionStateProof } from './TransactionStateProof.ts'

export type TransactionTxTypeEnum =
    | 'pay'
    | 'keyreg'
    | 'acfg'
    | 'axfer'
    | 'afrz'
    | 'appl'
    | 'stpf'
    | 'hb'

/**
 * @description Contains all fields common to all transactions and serves as an envelope to all transactions type. Represents both regular and inner transactions.\n\nDefinition:\ndata/transactions/signedtxn.go : SignedTxn\ndata/transactions/transaction.go : Transaction\n
 */
export type Transaction = {
    /**
     * @description Fields for application transactions.\n\nDefinition:\ndata/transactions/application.go : ApplicationCallTxnFields
     * @type object | undefined
     */
    'application-transaction'?: TransactionApplication
    /**
     * @description Fields for asset allocation, re-configuration, and destruction.\n\n\nA zero value for asset-id indicates asset creation.\nA zero value for the params indicates asset destruction.\n\nDefinition:\ndata/transactions/asset.go : AssetConfigTxnFields
     * @type object | undefined
     */
    'asset-config-transaction'?: TransactionAssetConfig
    /**
     * @description Fields for an asset freeze transaction.\n\nDefinition:\ndata/transactions/asset.go : AssetFreezeTxnFields
     * @type object | undefined
     */
    'asset-freeze-transaction'?: TransactionAssetFreeze
    /**
     * @description Fields for an asset transfer transaction.\n\nDefinition:\ndata/transactions/asset.go : AssetTransferTxnFields
     * @type object | undefined
     */
    'asset-transfer-transaction'?: TransactionAssetTransfer
    /**
     * @description \\[sgnr\\] this is included with signed transactions when the signing address does not equal the sender. The backend can use this to ensure that auth addr is equal to the accounts auth addr.
     * @type string | undefined
     */
    'auth-addr'?: string
    /**
     * @description \\[rc\\] rewards applied to close-remainder-to account.
     * @type integer | undefined
     */
    'close-rewards'?: number
    /**
     * @description \\[ca\\] closing amount for transaction.
     * @type integer | undefined
     */
    'closing-amount'?: number
    /**
     * @description Round when the transaction was confirmed.
     * @type integer | undefined
     */
    'confirmed-round'?: number
    /**
     * @description Specifies an application index (ID) if an application was created with this transaction.
     * @type integer | undefined
     */
    'created-application-index'?: number
    /**
     * @description Specifies an asset index (ID) if an asset was created with this transaction.
     * @type integer | undefined
     */
    'created-asset-index'?: number
    /**
     * @description \\[fee\\] Transaction fee.
     * @type integer
     */
    fee: number
    /**
     * @description \\[fv\\] First valid round for this transaction.
     * @type integer
     */
    'first-valid': number
    /**
     * @description \\[gh\\] Hash of genesis block.
     * @pattern ^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$
     * @type string | undefined, byte
     */
    'genesis-hash'?: string
    /**
     * @description \\[gen\\] genesis block ID.
     * @type string | undefined
     */
    'genesis-id'?: string
    /**
     * @description Application state delta.
     * @type array | undefined
     */
    'global-state-delta'?: StateDelta
    /**
     * @description \\[grp\\] Base64 encoded byte array of a sha512/256 digest. When present indicates that this transaction is part of a transaction group and the value is the sha512/256 hash of the transactions in that group.
     * @pattern ^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$
     * @type string | undefined, byte
     */
    group?: string
    /**
     * @description Fields for a heartbeat transaction.\n\nDefinition:\ndata/transactions/heartbeat.go : HeartbeatTxnFields
     * @type object | undefined
     */
    'heartbeat-transaction'?: TransactionHeartbeat
    /**
     * @description Transaction ID
     * @type string | undefined
     */
    id?: string
    /**
     * @description Inner transactions produced by application execution.
     * @type array | undefined
     */
    'inner-txns'?: Transaction[]
    /**
     * @description Offset into the round where this transaction was confirmed.
     * @type integer | undefined
     */
    'intra-round-offset'?: number
    /**
     * @description Fields for a keyreg transaction.\n\nDefinition:\ndata/transactions/keyreg.go : KeyregTxnFields
     * @type object | undefined
     */
    'keyreg-transaction'?: TransactionKeyreg
    /**
     * @description \\[lv\\] Last valid round for this transaction.
     * @type integer
     */
    'last-valid': number
    /**
     * @description \\[lx\\] Base64 encoded 32-byte array. Lease enforces mutual exclusion of transactions.  If this field is nonzero, then once the transaction is confirmed, it acquires the lease identified by the (Sender, Lease) pair of the transaction until the LastValid round passes.  While this transaction possesses the lease, no other transaction specifying this lease can be confirmed.
     * @pattern ^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$
     * @type string | undefined, byte
     */
    lease?: string
    /**
     * @description \\[ld\\] Local state key/value changes for the application being executed by this transaction.
     * @type array | undefined
     */
    'local-state-delta'?: AccountStateDelta[]
    /**
     * @description \\[lg\\] Logs for the application being executed by this transaction.
     * @type array | undefined
     */
    logs?: string[]
    /**
     * @description \\[note\\] Free form data.
     * @pattern ^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$
     * @type string | undefined, byte
     */
    note?: string
    /**
     * @description Fields for a payment transaction.\n\nDefinition:\ndata/transactions/payment.go : PaymentTxnFields
     * @type object | undefined
     */
    'payment-transaction'?: TransactionPayment
    /**
     * @description \\[rr\\] rewards applied to receiver account.
     * @type integer | undefined
     */
    'receiver-rewards'?: number
    /**
     * @description \\[rekey\\] when included in a valid transaction, the accounts auth addr will be updated with this value and future signatures must be signed with the key represented by this address.
     * @type string | undefined
     */
    'rekey-to'?: string
    /**
     * @description Time when the block this transaction is in was confirmed.
     * @type integer | undefined
     */
    'round-time'?: number
    /**
     * @description \\[snd\\] Sender\'s address.
     * @type string
     */
    sender: string
    /**
     * @description \\[rs\\] rewards applied to sender account.
     * @type integer | undefined
     */
    'sender-rewards'?: number
    /**
     * @description Validation signature associated with some data. Only one of the signatures should be provided.
     * @type object | undefined
     */
    signature?: TransactionSignature
    /**
     * @description Fields for a state proof transaction. \n\nDefinition:\ndata/transactions/stateproof.go : StateProofTxnFields
     * @type object | undefined
     */
    'state-proof-transaction'?: TransactionStateProof
    /**
     * @description \\[type\\] Indicates what type of transaction this is. Different types have different fields.\n\nValid types, and where their fields are stored:\n* \\[pay\\] payment-transaction\n* \\[keyreg\\] keyreg-transaction\n* \\[acfg\\] asset-config-transaction\n* \\[axfer\\] asset-transfer-transaction\n* \\[afrz\\] asset-freeze-transaction\n* \\[appl\\] application-transaction\n* \\[stpf\\] state-proof-transaction\n* \\[hb\\] heartbeat-transaction
     * @type string
     */
    'tx-type': TransactionTxTypeEnum
}
