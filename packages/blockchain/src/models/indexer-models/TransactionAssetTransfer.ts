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
 * @description Fields for an asset transfer transaction.\n\nDefinition:\ndata/transactions/asset.go : AssetTransferTxnFields
*/
export type TransactionAssetTransfer = {
    /**
     * @description \\[aamt\\] Amount of asset to transfer. A zero amount transferred to self allocates that asset in the account\'s Assets map.
     * @type integer
    */
    amount: number;
    /**
     * @description \\[xaid\\] ID of the asset being transferred.
     * @type integer
    */
    "asset-id": number;
    /**
     * @description Number of assets transferred to the close-to account as part of the transaction.
     * @type integer | undefined
    */
    "close-amount"?: number;
    /**
     * @description \\[aclose\\] Indicates that the asset should be removed from the account\'s Assets map, and specifies where the remaining asset holdings should be transferred.  It\'s always valid to transfer remaining asset holdings to the creator account.
     * @type string | undefined
    */
    "close-to"?: string;
    /**
     * @description \\[arcv\\] Recipient address of the transfer.
     * @type string
    */
    receiver: string;
    /**
     * @description \\[asnd\\] The effective sender during a clawback transactions. If this is not a zero value, the real transaction sender must be the Clawback address from the AssetParams.
     * @type string | undefined
    */
    sender?: string;
};