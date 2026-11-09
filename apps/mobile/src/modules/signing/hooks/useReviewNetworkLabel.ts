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

import { useSigningRequest } from '@perawallet/wallet-core-signing'
import { chainNetworkOf } from '@utils/chainNetwork'
import { useLanguage } from '@hooks/useLanguage'
import { useSignRequestScope } from './useSignRequestScope'

/** Names the network the current request will run on, from the request's own scope. */
export const useReviewNetworkLabel = (): string => {
    const { t } = useLanguage()
    const { currentRequest } = useSigningRequest()
    const scope = useSignRequestScope(currentRequest)

    return t('dapp.approval.chain_network', chainNetworkOf(scope))
}
