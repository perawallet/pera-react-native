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
 * @description A simplified version of AssetHolding
*/
export type MiniAssetHolding = {
    /**
     * @type string
    */
    address: string;
    /**
     * @type integer
    */
    amount: number;
    /**
     * @description Whether or not this asset holding is currently deleted from its account.
     * @type boolean | undefined
    */
    deleted?: boolean;
    /**
     * @type boolean
    */
    "is-frozen": boolean;
    /**
     * @description Round during which the account opted into the asset.
     * @type integer | undefined
    */
    "opted-in-at-round"?: number;
    /**
     * @description Round during which the account opted out of the asset.
     * @type integer | undefined
    */
    "opted-out-at-round"?: number;
};