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

import { PWScreen } from '@components/core'
import {
    type AuthDataSignRequest,
    useSigningPipeline,
} from '@perawallet/wallet-core-signing'
import { useFindAccountByAddress } from '@perawallet/wallet-core-accounts'
import type { Optional } from '@perawallet/wallet-core-shared'
import { Arc60DataSigningDetailsView } from '@modules/signing/components/Arc60DataSigningView'

export const Arc60SigningDetailsScreen = () => {
    const { currentRequest, resolved } = useSigningPipeline()
    const request = currentRequest as Optional<AuthDataSignRequest>

    const account = useFindAccountByAddress(request?.authData.signer ?? '')
    const parsed =
        resolved?.kind.type === 'auth-data' ? resolved.kind.parsed : null

    if (!request || !parsed) return null

    return (
        <PWScreen>
            <Arc60DataSigningDetailsView
                request={request}
                account={account ?? undefined}
                parsed={parsed}
            />
        </PWScreen>
    )
}
