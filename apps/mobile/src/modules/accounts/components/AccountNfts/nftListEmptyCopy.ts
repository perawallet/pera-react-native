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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { useLanguage } from '@hooks/useLanguage'

// A failed refresh comes first, then the user's hidden NFTs, then suspicious: a
// search or chip that only matched filtered-out NFTs should say how to show
// them, not that nothing matched.
export const nftListEmptyCopy = ({
    t,
    isRefreshFailed,
    isUserHidden,
    isSuspiciousHidden,
    isNetworkEmpty,
    selectedChainId,
}: {
    t: ReturnType<typeof useLanguage>['t']
    isRefreshFailed: boolean
    isUserHidden: boolean
    isSuspiciousHidden: boolean
    isNetworkEmpty: boolean
    selectedChainId: Nullable<ChainId>
}): { title: string; body: string } => {
    if (isRefreshFailed) {
        return {
            title: t('account_details.nfts.refresh_error_title'),
            body: t('account_details.nfts.refresh_error_body'),
        }
    }
    if (isUserHidden) {
        return {
            title: t('account_details.nfts.user_hidden_title'),
            body: t('account_details.nfts.user_hidden_body'),
        }
    }
    if (isSuspiciousHidden) {
        return {
            title: t('account_details.nfts.suspicious_hidden_title'),
            body: t('account_details.nfts.suspicious_hidden_body'),
        }
    }
    if (isNetworkEmpty) {
        return {
            title: t('account_details.nfts.network_empty_title'),
            body: t('account_details.nfts.network_empty_body', {
                chain:
                    selectedChainId === null
                        ? ''
                        : (chainDisplayNameOf(selectedChainId) ??
                          selectedChainId),
            }),
        }
    }
    return {
        title: t('account_details.nfts.nomatch_title'),
        body: t('account_details.nfts.nomatch_body'),
    }
}
