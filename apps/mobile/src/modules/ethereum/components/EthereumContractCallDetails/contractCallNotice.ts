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

import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import {
    originOf,
    stripUrlScheme,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'

export type ContractCallNotice = {
    titleKey: I18nKey
    params?: { domain: string }
}

const hostOf = (url?: string): Optional<string> => {
    const origin = originOf(url)
    return origin ? stripUrlScheme(origin) : undefined
}

/**
 * Names who asked, preferring what the platform observed over what the
 * transport verified, and both over the dApp's own claim.
 */
export const contractCallNoticeOf = (
    source?: SignRequestSource,
    verifiedOrigin?: string,
): ContractCallNotice => {
    const domain =
        hostOf(verifiedOrigin) ??
        hostOf(source?.verification?.verifiedOrigin) ??
        hostOf(source?.url)

    return domain
        ? {
              titleKey: i18nKey('transactions.contract_call.unchecked_warning'),
              params: { domain },
          }
        : {
              titleKey: i18nKey(
                  'transactions.contract_call.unchecked_warning_no_source',
              ),
          }
}
