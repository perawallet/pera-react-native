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
    i18nKey,
    type ChainFamily,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { chainUiFor } from '@modules/chain-ui'
import type { WatchAccountCopy } from '../types'

const GENERIC_WATCH_ACCOUNT_COPY: WatchAccountCopy = {
    optionDescriptionKey: i18nKey(
        'onboarding.add_account.watch_address_option_description_generic',
    ),
    descriptionKey: i18nKey('onboarding.watch_account.description_generic'),
    invalidAddressKey: i18nKey(
        'onboarding.watch_account.invalid_address_generic',
    ),
}

/** The family's own copy while every chain in `chainIds` belongs to it, else copy that names no chain. */
export const useWatchAccountCopy = (
    chainIds: readonly ChainId[],
): WatchAccountCopy => {
    const families = new Set<ChainFamily>(
        getProvider()
            .chains.list()
            .filter(({ id }) => chainIds.includes(id))
            .map(({ family }) => family),
    )
    const [onlyFamily] = families.size === 1 ? families : []
    return (
        (onlyFamily && chainUiFor(onlyFamily).watchAccountCopy) ??
        GENERIC_WATCH_ACCOUNT_COPY
    )
}
