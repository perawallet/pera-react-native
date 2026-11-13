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
import { hidesUnknownContractNotice } from '@perawallet/wallet-core-chain-ethereum'
import {
    originOf,
    stripUrlScheme,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import type { EthereumTransactionPresentation } from '../hooks/useEthereumTransactionPresentation'

export type ContractCallNotice = {
    titleKey: I18nKey
    params?: { domain: string }
}

const hostOf = (url?: string): Optional<string> => {
    const origin = originOf(url)
    return origin ? stripUrlScheme(origin) : undefined
}

/**
 * Names who asked only when the platform observed it or the transport
 * attested it, the observed origin first. The dApp's own claimed url never
 * reaches this copy.
 */
export const requesterHostOf = (
    source?: SignRequestSource,
    verifiedOrigin?: string,
): Optional<string> =>
    hostOf(verifiedOrigin) ?? hostOf(source?.verification?.verifiedOrigin)

export const contractCallNoticeOf = (
    source?: SignRequestSource,
    verifiedOrigin?: string,
): ContractCallNotice => {
    const domain = requesterHostOf(source, verifiedOrigin)

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

/**
 * Pera read nothing of the call that explains it, so the review carries the
 * unchecked-call notice. A simulation that can't answer adds nothing to it.
 */
export const isCallUnexplained = ({
    view,
    standardCall,
    contractAction,
}: Pick<
    EthereumTransactionPresentation,
    'view' | 'standardCall' | 'contractAction'
>): boolean =>
    !standardCall &&
    !(!!contractAction && hidesUnknownContractNotice(view.action))
