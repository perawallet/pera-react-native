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

import {
    ArbitraryDataSignRequest,
    Arc60SignRequest,
    SignRequest,
    TransactionSignRequest,
} from '@perawallet/wallet-core-blockchain'
import EmptyView from '@components/empty-view/EmptyView'
import TransactionSigningView from './TransactionSigningView'
import ArbitraryDataSigningView from './ArbitraryDataSigningView'
import Arc60SigningView from './Arc60SigningView'

type SigningViewProps = {
    request: SignRequest
}

const SigningView = ({ request }: SigningViewProps) => {
    switch (request.type) {
        case 'transactions':
            return (
                <TransactionSigningView
                    request={request as TransactionSignRequest}
                />
            )
        case 'arbitrary-data':
            return (
                <ArbitraryDataSigningView
                    request={request as ArbitraryDataSignRequest}
                />
            )
        case 'arc60':
            return <Arc60SigningView request={request as Arc60SignRequest} />
        default:
            return (
                <EmptyView
                    title='Unknown Request Type'
                    body='The request type is unknown.'
                />
            )
    }
}

export default SigningView
