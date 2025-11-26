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

import type { Box } from "./Box.ts";

export type LookupApplicationBoxByIDAndNamePathParams = {
    /**
     * @type integer
    */
    "application-id": number;
};

export type LookupApplicationBoxByIDAndNameQueryParams = {
    /**
     * @description A box name in goal-arg form \'encoding:value\'. For ints, use the form \'int:1234\'. For raw bytes, use the form \'b64:A==\'. For printable strings, use the form \'str:hello\'. For addresses, use the form \'addr:XYZ...\'.
     * @type string
    */
    name: string;
};

/**
 * @description Box information
*/
export type LookupApplicationBoxByIDAndName200 = Box;

/**
 * @description Response for errors
*/
export type LookupApplicationBoxByIDAndName400 = {
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
export type LookupApplicationBoxByIDAndName404 = {
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
export type LookupApplicationBoxByIDAndName500 = {
    /**
     * @type object | undefined
    */
    data?: object;
    /**
     * @type string
    */
    message: string;
};

export type LookupApplicationBoxByIDAndNameQueryResponse = LookupApplicationBoxByIDAndName200;

export type LookupApplicationBoxByIDAndNameQuery = {
    Response: LookupApplicationBoxByIDAndName200;
    PathParams: LookupApplicationBoxByIDAndNamePathParams;
    QueryParams: LookupApplicationBoxByIDAndNameQueryParams;
    Errors: LookupApplicationBoxByIDAndName400 | LookupApplicationBoxByIDAndName404 | LookupApplicationBoxByIDAndName500;
};