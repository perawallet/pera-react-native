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

import type { AssetHolding } from "./AssetHolding.ts";

export type LookupAccountAssetsPathParams = {
    /**
     * @description account string
     * @type string
    */
    "account-id": string;
};

export type LookupAccountAssetsQueryParams = {
    /**
     * @description Asset ID
     * @type integer | undefined
    */
    "asset-id"?: number;
    /**
     * @description Include all items including closed accounts, deleted applications, destroyed assets, opted-out asset holdings, and closed-out application localstates.
     * @type boolean | undefined
    */
    "include-all"?: boolean;
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
};

/**
 * @description (empty)
*/
export type LookupAccountAssets200 = {
    /**
     * @type array
    */
    assets: AssetHolding[];
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
};

/**
 * @description Response for errors
*/
export type LookupAccountAssets400 = {
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
export type LookupAccountAssets404 = {
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
export type LookupAccountAssets500 = {
    /**
     * @type object | undefined
    */
    data?: object;
    /**
     * @type string
    */
    message: string;
};

export type LookupAccountAssetsQueryResponse = LookupAccountAssets200;

export type LookupAccountAssetsQuery = {
    Response: LookupAccountAssets200;
    PathParams: LookupAccountAssetsPathParams;
    QueryParams: LookupAccountAssetsQueryParams;
    Errors: LookupAccountAssets400 | LookupAccountAssets404 | LookupAccountAssets500;
};