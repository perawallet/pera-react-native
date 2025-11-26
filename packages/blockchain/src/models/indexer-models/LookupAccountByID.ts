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

import type { Account } from "./Account.ts";

export type LookupAccountByIDPathParams = {
    /**
     * @description account string
     * @type string
    */
    "account-id": string;
};

export type LookupAccountByIDQueryParamsExcludeEnum = "all" | "assets" | "created-assets" | "apps-local-state" | "created-apps" | "none";

export type LookupAccountByIDQueryParams = {
    /**
     * @description Include results for the specified round.
     * @type integer | undefined
    */
    round?: number;
    /**
     * @description Include all items including closed accounts, deleted applications, destroyed assets, opted-out asset holdings, and closed-out application localstates.
     * @type boolean | undefined
    */
    "include-all"?: boolean;
    /**
     * @description Exclude additional items such as asset holdings, application local data stored for this account, asset parameters created by this account, and application parameters created by this account.
     * @type array | undefined
    */
    exclude?: LookupAccountByIDQueryParamsExcludeEnum[];
};

/**
 * @description (empty)
*/
export type LookupAccountByID200 = {
    /**
     * @description Account information at a given round.\n\nDefinition:\ndata/basics/userBalance.go : AccountData\n
     * @type object
    */
    account: Account;
    /**
     * @description Round at which the results were computed.
     * @type integer
    */
    "current-round": number;
};

/**
 * @description Response for errors
*/
export type LookupAccountByID400 = {
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
export type LookupAccountByID404 = {
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
export type LookupAccountByID500 = {
    /**
     * @type object | undefined
    */
    data?: object;
    /**
     * @type string
    */
    message: string;
};

export type LookupAccountByIDQueryResponse = LookupAccountByID200;

export type LookupAccountByIDQuery = {
    Response: LookupAccountByID200;
    PathParams: LookupAccountByIDPathParams;
    QueryParams: LookupAccountByIDQueryParams;
    Errors: LookupAccountByID400 | LookupAccountByID404 | LookupAccountByID500;
};