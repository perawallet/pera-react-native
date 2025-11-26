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

import type { TransactionSignatureLogicsig } from './TransactionSignatureLogicsig.ts'
import type { TransactionSignatureMultisig } from './TransactionSignatureMultisig.ts'

/**
 * @description Validation signature associated with some data. Only one of the signatures should be provided.
 */
export type TransactionSignature = {
    /**
     * @description \\[lsig\\] Programatic transaction signature.\n\nDefinition:\ndata/transactions/logicsig.go
     * @type object | undefined
     */
    logicsig?: TransactionSignatureLogicsig
    /**
     * @description structure holding multiple subsignatures.\n\nDefinition:\ncrypto/multisig.go : MultisigSig
     * @type object | undefined
     */
    multisig?: TransactionSignatureMultisig
    /**
     * @description \\[sig\\] Standard ed25519 signature.
     * @pattern ^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$
     * @type string | undefined, byte
     */
    sig?: string
}
