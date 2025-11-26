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


/**
 * @description Fields for a keyreg transaction.\n\nDefinition:\ndata/transactions/keyreg.go : KeyregTxnFields
*/
export type TransactionKeyreg = {
    /**
     * @description \\[nonpart\\] Mark the account as participating or non-participating.
     * @type boolean | undefined
    */
    "non-participation"?: boolean;
    /**
     * @description \\[selkey\\] Public key used with the Verified Random Function (VRF) result during committee selection.
     * @pattern ^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$
     * @type string | undefined, byte
    */
    "selection-participation-key"?: string;
    /**
     * @description \\[sprfkey\\] State proof key used in key registration transactions.
     * @pattern ^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$
     * @type string | undefined, byte
    */
    "state-proof-key"?: string;
    /**
     * @description \\[votefst\\] First round this participation key is valid.
     * @type integer | undefined
    */
    "vote-first-valid"?: number;
    /**
     * @description \\[votekd\\] Number of subkeys in each batch of participation keys.
     * @type integer | undefined
    */
    "vote-key-dilution"?: number;
    /**
     * @description \\[votelst\\] Last round this participation key is valid.
     * @type integer | undefined
    */
    "vote-last-valid"?: number;
    /**
     * @description \\[votekey\\] Participation public key used in key registration transactions.
     * @pattern ^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$
     * @type string | undefined, byte
    */
    "vote-participation-key"?: string;
};