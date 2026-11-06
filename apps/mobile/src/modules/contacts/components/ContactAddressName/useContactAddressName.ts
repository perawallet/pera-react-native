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
    nameServiceOf,
    useNameForAddressQuery,
} from '@perawallet/wallet-core-nfd'
import type { ChainId, I18nKey } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import type { Optional } from '@perawallet/wallet-core-shared'
import { NAME_SERVICE_COPY } from '@utils/nameServiceCopy'

export type UseContactAddressNameResult = {
    name: Optional<string>
    labelKey: I18nKey
}

export const useContactAddressName = (
    address: string,
    chainId: ChainId,
): UseContactAddressNameResult => {
    const scope = useSelectedScope(chainId)
    const { data } = useNameForAddressQuery(scope, address)

    return {
        name: data.at(0)?.name,
        labelKey: NAME_SERVICE_COPY[nameServiceOf(scope)].addressNameLabelKey,
    }
}
