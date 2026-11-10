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

import type { Optional } from '@perawallet/wallet-core-shared'
import { nativeAssetInfoOf } from '@modules/chain-ui/icon'
import type { GroupableHolding, GroupedHoldingMember } from './groupedHoldings'

export const isNativeGroupHolding = ({
    scope,
    assetId,
}: GroupableHolding): boolean =>
    nativeAssetInfoOf({ chainId: scope.chainId, assetId }) !== undefined

// The first network with a logo, so one logo-less row doesn't leave the
// whole group on initials. A native member draws its own mark, so it keeps
// the icon over a token's logo.
export const groupIconMemberOf = <T extends GroupableHolding>(
    members: GroupedHoldingMember<T>[],
): Optional<GroupedHoldingMember<T>> =>
    members.find(({ holding }) => isNativeGroupHolding(holding)) ??
    members.find(({ asset }) => asset?.peraMetadata?.logo) ??
    members[0]
