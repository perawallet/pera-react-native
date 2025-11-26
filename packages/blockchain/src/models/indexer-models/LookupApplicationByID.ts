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

import type { Application } from "./Application.ts";

export type LookupApplicationByIDPathParams = {
    /**
     * @type integer
    */
    "application-id": number;
};

export type LookupApplicationByIDQueryParams = {
    /**
     * @description Include all items including closed accounts, deleted applications, destroyed assets, opted-out asset holdings, and closed-out application localstates.
     * @type boolean | undefined
    */
    "include-all"?: boolean;
};

/**
 * @description (empty)
*/
export type LookupApplicationByID200 = {
    /**
     * @description Application index and its parameters
     * @type object | undefined
    */
    application?: Application;
    /**
     * @description Round at which the results were computed.
     * @type integer
    */
    "current-round": number;
};

/**
 * @description Response for errors
*/
export type LookupApplicationByID404 = {
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
export type LookupApplicationByID500 = {
    /**
     * @type object | undefined
    */
    data?: object;
    /**
     * @type string
    */
    message: string;
};

export type LookupApplicationByIDQueryResponse = LookupApplicationByID200;

export type LookupApplicationByIDQuery = {
    Response: LookupApplicationByID200;
    PathParams: LookupApplicationByIDPathParams;
    QueryParams: LookupApplicationByIDQueryParams;
    Errors: LookupApplicationByID404 | LookupApplicationByID500;
};