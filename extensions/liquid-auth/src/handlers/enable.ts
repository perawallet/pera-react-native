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

import type { Arc0027Handler } from '../arc0027/dispatcher'

export type EnableConfig = {
    providerId: string
    genesisHash: string
    genesisId: string
    /**
     * The FIDO-bound account(s) approved at connect time. Liquid Auth binds the
     * address during the ceremony, so `enable` (if a dApp sends it) just echoes
     * the already-approved account — there's no separate consent step here.
     */
    accounts: string[]
}

export const createEnableHandler =
    (config: EnableConfig): Arc0027Handler =>
    async () => {
        return {
            providerId: config.providerId,
            genesisHash: config.genesisHash,
            genesisId: config.genesisId,
            accounts: config.accounts.map(address => ({ address })),
        }
    }
