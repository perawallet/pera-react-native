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

/**
 * @description LocalsRef names a local state by referring to an Address and App it belongs to.
 */
export type LocalsRef = {
    /**
     * @description \\[d\\] Address in access list, or the sender of the transaction.
     * @type string
     */
    address: string
    /**
     * @description \\[p\\] Application ID for app in access list, or zero if referring to the called application.
     * @type integer
     */
    app: number
}
