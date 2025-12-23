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
import { Arc60SignRequest } from "@perawallet/wallet-core-blockchain"
import { logger } from '@perawallet/wallet-core-shared'

type Arc60SigningViewProps = {
    request: Arc60SignRequest
}

//TODO implement me
const Arc60SigningView = ({ request }: Arc60SigningViewProps) => {
    logger.warn('Arc60 signing not implemented yet', request)
    return (
        <EmptyView
            title='Arc60 Not Implemented'
            body='Arc60 signing has not been implemented yet.'
        />
    )
}

export default Arc60SigningView
