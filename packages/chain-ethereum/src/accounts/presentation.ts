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

import type {
    AccountKindPresentation,
    AccountPresentationChainAdapter,
} from '@perawallet/wallet-core-accounts'
import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { EvmChain } from '../chains/types'

// No supportUrl: every configured account article describes Algorand accounts.
// Keyed by the ids `ethereumKindIdOf` gives.
const EVM_KIND_COPY: Readonly<Record<string, AccountKindPresentation>> = {
    standalone: {
        labelKey: i18nKey('account_info.type_private_key'),
        infoTitleKey: i18nKey('account_type_info.private_key_title'),
        infoBodyKey: i18nKey('account_type_info.private_key_description'),
        glyph: 'accounts/glyph/algo25-account',
    },
    hd: {
        labelKey: i18nKey('account_info.type_universal_wallet'),
        infoTitleKey: i18nKey('account_type_info.hd_wallet_title'),
        infoBodyKey: i18nKey('account_type_info.hd_wallet_description'),
        glyph: 'accounts/glyph/hdwallet-account',
    },
    hardware: {
        labelKey: i18nKey('account_info.type_ledger'),
        infoTitleKey: i18nKey('account_type_info.ledger_title'),
        infoBodyKey: i18nKey('account_type_info.ledger_description'),
        glyph: 'accounts/glyph/ledger-account',
    },
    watch: {
        labelKey: i18nKey('account_info.type_watch'),
        infoTitleKey: i18nKey('account_type_info.watch_title'),
        infoBodyKey: i18nKey('account_type_info.watch_description'),
        glyph: 'accounts/glyph/watch-account',
    },
}

export const createEvmAccountPresentation = (
    chain: EvmChain,
): AccountPresentationChainAdapter => ({
    chainId: chain.descriptor.id,
    describe: (kindId): Optional<AccountKindPresentation> =>
        Object.hasOwn(EVM_KIND_COPY, kindId)
            ? EVM_KIND_COPY[kindId]
            : undefined,
})
