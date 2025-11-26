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

import type { BoxDescriptor } from "./BoxDescriptor.ts";

export type SearchForApplicationBoxesPathParams = {
    /**
     * @type integer
    */
    "application-id": number;
};

export type SearchForApplicationBoxesQueryParams = {
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
 * @description Box names of an application
*/
export type SearchForApplicationBoxes200 = {
    /**
     * @description \\[appidx\\] application index.
     * @type integer
    */
    "application-id": number;
    /**
     * @type array
    */
    boxes: BoxDescriptor[];
    /**
     * @description Used for pagination, when making another request provide this token with the next parameter.
     * @type string | undefined
    */
    "next-token"?: string;
};

/**
 * @description Response for errors
*/
export type SearchForApplicationBoxes400 = {
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
export type SearchForApplicationBoxes404 = {
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
export type SearchForApplicationBoxes500 = {
    /**
     * @type object | undefined
    */
    data?: object;
    /**
     * @type string
    */
    message: string;
};

export type SearchForApplicationBoxesQueryResponse = SearchForApplicationBoxes200;

export type SearchForApplicationBoxesQuery = {
    Response: SearchForApplicationBoxes200;
    PathParams: SearchForApplicationBoxesPathParams;
    QueryParams: SearchForApplicationBoxesQueryParams;
    Errors: SearchForApplicationBoxes400 | SearchForApplicationBoxes404 | SearchForApplicationBoxes500;
};