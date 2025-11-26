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

import type { AssetHolding } from "./AssetHolding.ts";

export type AssetHoldingsResponse = {
    /**
     * @type array
    */
    assets: AssetHolding[];
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