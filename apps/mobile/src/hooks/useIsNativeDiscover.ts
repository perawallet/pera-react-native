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

import { useRegisteredChainIds } from '@perawallet/wallet-core-accounts'

/**
 * Discover is native on a multichain build, one whose `CHAINS` registers more
 * than one chain, and the Discover web app on an Algorand-only build. The
 * same test as the accounts module's `useIsMultichain`.
 */
export const useIsNativeDiscover = (): boolean => {
    return useRegisteredChainIds().length > 1
}
