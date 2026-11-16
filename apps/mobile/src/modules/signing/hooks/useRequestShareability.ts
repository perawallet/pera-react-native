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

import { useRequestAddressSafety } from './useRequestAddressSafety'

export type UseRequestShareabilityResult = {
    /** The request's addresses are still being checked. */
    isChecking: boolean
    /** The request may be sent to a backend service, such as simulation. */
    isShareable: boolean
}

/** A request naming a scam-listed address is never sent on, so the address never reaches a lookup service. */
export const useRequestShareability = (): UseRequestShareabilityResult => {
    const { isChecking, hasListedAddress } = useRequestAddressSafety()
    return { isChecking, isShareable: !isChecking && !hasListedAddress }
}
