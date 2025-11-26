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

export type LookupTransactionPathParams = {
    /**
     * @type string
    */
    txid: string;
};

/**
 * @description (empty)
*/
export type LookupTransaction200 = {
    /**
     * @description Round at which the results were computed.
     * @type integer
    */
    "current-round": number;
    /**
     * @description Contains all fields common to all transactions and serves as an envelope to all transactions type. Represents both regular and inner transactions.\n\nDefinition:\ndata/transactions/signedtxn.go : SignedTxn\ndata/transactions/transaction.go : Transaction\n
     * @type object
    */
    transaction: Transaction;
};

/**
 * @description Response for errors
*/
export type LookupTransaction400 = {
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
export type LookupTransaction404 = {
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
export type LookupTransaction500 = {
    /**
     * @type object | undefined
    */
    data?: object;
    /**
     * @type string
    */
    message: string;
};

export type LookupTransactionQueryResponse = LookupTransaction200;

export type LookupTransactionQuery = {
    Response: LookupTransaction200;
    PathParams: LookupTransactionPathParams;
    Errors: LookupTransaction400 | LookupTransaction404 | LookupTransaction500;
};