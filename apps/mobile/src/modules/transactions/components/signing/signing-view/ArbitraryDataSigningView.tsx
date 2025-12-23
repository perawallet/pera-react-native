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

import EmptyView from '@components/empty-view/EmptyView'
import { ArbitraryDataSignRequest } from "@perawallet/wallet-core-blockchain"
import { logger } from '@perawallet/wallet-core-shared'

type ArbitraryDataSigningViewProps = {
    request: ArbitraryDataSignRequest
}

//TODO implement me
const ArbitraryDataSigningView = ({ request }: ArbitraryDataSigningViewProps) => {
    logger.warn('Arbitrary data signing not implemented yet', request)
    return (
        <EmptyView
            title='Arbitrary Data Not Implemented'
            body='Arbitrary data signing has not been implemented yet.'
        />
    )
}

export default ArbitraryDataSigningView
