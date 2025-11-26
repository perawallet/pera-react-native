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
 * @description Fields for an asset freeze transaction.\n\nDefinition:\ndata/transactions/asset.go : AssetFreezeTxnFields
 */
export type TransactionAssetFreeze = {
    /**
     * @description \\[fadd\\] Address of the account whose asset is being frozen or thawed.
     * @type string
     */
    address: string
    /**
     * @description \\[faid\\] ID of the asset being frozen or thawed.
     * @type integer
     */
    'asset-id': number
    /**
     * @description \\[afrz\\] The new freeze status.
     * @type boolean
     */
    'new-freeze-status': boolean
}
