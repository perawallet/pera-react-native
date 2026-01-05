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

import { PeraTransaction } from '../models'

// import { encodeTransaction } from '@algorandfoundation/algokit-utils/transact'

export const useTransactionEncoder = () => {
    return {
        encodeTransaction: (_: PeraTransaction) => {
            //TODO: implement this once we can find encodeTransaction in algokit-utils somewhere
            return Uint8Array.from([0])
        },
        decodeTransaction: (_: Uint8Array) => {
            //TODO: implement this once we can find decodeTransaction in algokit-utils somewhere
            return {} as PeraTransaction
        },
    }
}
