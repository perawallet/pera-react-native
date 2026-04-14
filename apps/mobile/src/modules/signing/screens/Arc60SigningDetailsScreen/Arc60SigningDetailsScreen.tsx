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

import { useMemo } from 'react'
import { PWView } from '@components/core'
import {
    type Arc60SignRequest,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import { useFindAccountByAddress } from '@perawallet/wallet-core-accounts'
import {
    Arc60DataSigningDetailsView,
    parseArc60ForDisplay,
} from '@modules/signing/components/Arc60DataSigningView'
import { useStyles } from './styles'

export const Arc60SigningDetailsScreen = () => {
    const styles = useStyles()
    const { currentRequest } = useSigningRequest()
    const request = currentRequest as Arc60SignRequest | undefined

    const account = useFindAccountByAddress(request?.stdSigData.signer ?? '')
    const parsed = useMemo(
        () =>
            request
                ? parseArc60ForDisplay(
                      request.stdSigData.data,
                      request.metadata.encoding,
                  )
                : null,
        [request],
    )

    if (!request || !parsed) return null

    return (
        <PWView style={styles.container}>
            <Arc60DataSigningDetailsView
                request={request}
                account={account ?? undefined}
                parsed={parsed}
            />
        </PWView>
    )
}
