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

import { AssetIcon } from '@components/AssetIcon'
import { CircleFlag } from '@components/CircleFlag'
import type { RampToken } from '@perawallet/wallet-core-onramp'
import { useOnrampAccount } from '@modules/onramp/hooks/useOnrampAccount'
import { buildDisplayableAssetFromRampToken } from '../../buildDisplayableAssetFromRampToken'

// FIAT tokens (countryCode set) render the round country flag, matching the
// rest of the onramp UI; crypto tokens render their backend logo.
export type TokenIconProps = {
    token: RampToken
}

export const TokenIcon = ({ token }: TokenIconProps) => {
    const { scope } = useOnrampAccount()
    return token.countryCode ? (
        <CircleFlag
            countryCode={token.countryCode}
            size='md'
        />
    ) : (
        <AssetIcon
            chainId={scope?.chainId ?? null}
            asset={buildDisplayableAssetFromRampToken(token, scope)}
            logoUrl={token.logo ?? undefined}
            size='md'
        />
    )
}
