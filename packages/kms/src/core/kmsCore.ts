/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import {
    getKeystoreStore,
    getProvider,
} from '@perawallet/wallet-extension-provider'
import { createKmsCore } from './createKmsCore'

const core = createKmsCore({
    keyStore: () => getProvider().key.store,
    keys: () => getKeystoreStore().state.keys,
})

/**
 * The KMS for callers that can't use hooks, such as chain adapters. Every
 * operation resolves the governing seed and runs its ACL check before the
 * keystore is reached.
 */
export const kmsCore = {
    deriveFromSeed: core.deriveFromSeed,
    importRawKey: core.importRawKey,
    sign: core.sign,
}
