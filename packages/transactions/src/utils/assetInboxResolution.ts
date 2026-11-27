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

import type { AssetInboxRequest } from '../chain-adapter'

export type AssetInboxResolution = 'claim' | 'reject'

// The opt-in a claim performs raises the account's minimum balance, so a claim
// the backend says is unaffordable can only go ahead when the inbox itself
// carries enough native funds to cover it. Rejecting only pays a fee, so it
// can be affordable when claiming is not.
export const isAssetInboxResolutionBlocked = (
    request: AssetInboxRequest,
    mode: AssetInboxResolution,
): boolean =>
    mode === 'claim'
        ? request.insufficientNativeForClaiming &&
          !request.shouldUseFundsBeforeClaiming
        : request.insufficientNativeForRejecting &&
          !request.shouldUseFundsBeforeRejecting

/** Whether resolving the request first moves the inbox's native funds to the account. */
export const shouldUseAssetInboxFunds = (
    request: AssetInboxRequest,
    mode: AssetInboxResolution,
): boolean =>
    mode === 'claim'
        ? request.shouldUseFundsBeforeClaiming
        : request.shouldUseFundsBeforeRejecting
