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

export type SearchForApplicationsQueryParams = {
    /**
     * @description Application ID
     * @type integer | undefined
    */
    "application-id"?: number;
    /**
     * @description Filter just applications with the given creator address.
     * @type string | undefined
    */
    creator?: string;
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
export type SearchForApplications200 = {
    /**
     * @type array
    */
    applications: Application[];
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
export type SearchForApplications500 = {
    /**
     * @type object | undefined
    */
    data?: object;
    /**
     * @type string
    */
    message: string;
};

export type SearchForApplicationsQueryResponse = SearchForApplications200;

export type SearchForApplicationsQuery = {
    Response: SearchForApplications200;
    QueryParams: SearchForApplicationsQueryParams;
    Errors: SearchForApplications500;
};