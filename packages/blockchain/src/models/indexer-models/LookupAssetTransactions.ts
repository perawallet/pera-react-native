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

import type { Transaction } from "./Transaction.ts";

export type LookupAssetTransactionsPathParams = {
    /**
     * @type integer
    */
    "asset-id": number;
};

export type LookupAssetTransactionsQueryParamsTxTypeEnum = "pay" | "keyreg" | "acfg" | "axfer" | "afrz" | "appl" | "stpf" | "hb";

export type LookupAssetTransactionsQueryParamsSigTypeEnum = "sig" | "msig" | "lsig";

export type LookupAssetTransactionsQueryParamsAddressRoleEnum = "sender" | "receiver" | "freeze-target";

export type LookupAssetTransactionsQueryParams = {
    /**
     * @description Maximum number of results to return. There could be additional pages even if the limit is not reached.
     * @type integer | undefined
    */
    limit?: number;
    /**
     * @description The next page of results. Use the next token provided by the previous results.
     * @type string | undefined
    */
    next?: string;
    /**
     * @description Specifies a prefix which must be contained in the note field.
     * @type string | undefined
    */
    "note-prefix"?: string;
    /**
     * @type string | undefined
    */
    "tx-type"?: LookupAssetTransactionsQueryParamsTxTypeEnum;
    /**
     * @description SigType filters just results using the specified type of signature:\n* sig - Standard\n* msig - MultiSig\n* lsig - LogicSig
     * @type string | undefined
    */
    "sig-type"?: LookupAssetTransactionsQueryParamsSigTypeEnum;
    /**
     * @description Lookup the specific transaction by ID.
     * @type string | undefined
    */
    txid?: string;
    /**
     * @description Include results for the specified round.
     * @type integer | undefined
    */
    round?: number;
    /**
     * @description Include results at or after the specified min-round.
     * @type integer | undefined
    */
    "min-round"?: number;
    /**
     * @description Include results at or before the specified max-round.
     * @type integer | undefined
    */
    "max-round"?: number;
    /**
     * @description Include results before the given time. Must be an RFC 3339 formatted string.
     * @type string | undefined, date-time
    */
    "before-time"?: string;
    /**
     * @description Include results after the given time. Must be an RFC 3339 formatted string.
     * @type string | undefined, date-time
    */
    "after-time"?: string;
    /**
     * @description Results should have an amount greater than this value. MicroAlgos are the default currency unless an asset-id is provided, in which case the asset will be used.
     * @type integer | undefined
    */
    "currency-greater-than"?: number;
    /**
     * @description Results should have an amount less than this value. MicroAlgos are the default currency unless an asset-id is provided, in which case the asset will be used.
     * @type integer | undefined
    */
    "currency-less-than"?: number;
    /**
     * @description Only include transactions with this address in one of the transaction fields.
     * @type string | undefined
    */
    address?: string;
    /**
     * @description Combine with the address parameter to define what type of address to search for.
     * @type string | undefined
    */
    "address-role"?: LookupAssetTransactionsQueryParamsAddressRoleEnum;
    /**
     * @description Combine with address and address-role parameters to define what type of address to search for. The close to fields are normally treated as a receiver, if you would like to exclude them set this parameter to true.
     * @type boolean | undefined
    */
    "exclude-close-to"?: boolean;
    /**
     * @description Include results which include the rekey-to field.
     * @type boolean | undefined
    */
    "rekey-to"?: boolean;
};

/**
 * @description (empty)
*/
export type LookupAssetTransactions200 = {
    /**
     * @description Round at which the results were computed.
     * @type integer
    */
    "current-round": number;
    /**
     * @description Used for pagination, when making another request provide this token with the next parameter.
     * @type string | undefined
    */
    "next-token"?: string;
    /**
     * @type array
    */
    transactions: Transaction[];
};

/**
 * @description Response for errors
*/
export type LookupAssetTransactions400 = {
    /**
     * @type object | undefined
    */
    data?: object;
    /**
     * @type string
    */
    message: string;
};

/**
 * @description Response for errors
*/
export type LookupAssetTransactions500 = {
    /**
     * @type object | undefined
    */
    data?: object;
    /**
     * @type string
    */
    message: string;
};

export type LookupAssetTransactionsQueryResponse = LookupAssetTransactions200;

export type LookupAssetTransactionsQuery = {
    Response: LookupAssetTransactions200;
    PathParams: LookupAssetTransactionsPathParams;
    QueryParams: LookupAssetTransactionsQueryParams;
    Errors: LookupAssetTransactions400 | LookupAssetTransactions500;
};