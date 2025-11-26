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
 * @description Fields for a payment transaction.\n\nDefinition:\ndata/transactions/payment.go : PaymentTxnFields
*/
export type TransactionPayment = {
    /**
     * @description \\[amt\\] number of MicroAlgos intended to be transferred.
     * @type integer
    */
    amount: number;
    /**
     * @description Number of MicroAlgos that were sent to the close-remainder-to address when closing the sender account.
     * @type integer | undefined
    */
    "close-amount"?: number;
    /**
     * @description \\[close\\] when set, indicates that the sending account should be closed and all remaining funds be transferred to this address.
     * @type string | undefined
    */
    "close-remainder-to"?: string;
    /**
     * @description \\[rcv\\] receiver\'s address.
     * @type string
    */
    receiver: string;
};