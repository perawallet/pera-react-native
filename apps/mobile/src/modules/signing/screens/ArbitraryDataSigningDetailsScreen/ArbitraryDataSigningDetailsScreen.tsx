/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    type ArbitraryDataSignRequest,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import { ArbitraryDataSigningDetailsView } from '@modules/signing/components/ArbitraryDataSigningView/ArbitraryDataSigningDetailsView'
import type { SigningStackScreenProps } from '@modules/signing/routes'

export const ArbitraryDataSigningDetailsScreen = ({
    route,
}: SigningStackScreenProps<'ArbitraryDataSigningDetails'>) => {
    const { currentRequest } = useSigningRequest()
    const request = currentRequest as ArbitraryDataSignRequest

    if (!request) return null

    return (
        <PWScreen scroll={false}>
            <ArbitraryDataSigningDetailsView
                request={request}
                dataMessage={route.params.message}
            />
        </PWScreen>
    )
}
