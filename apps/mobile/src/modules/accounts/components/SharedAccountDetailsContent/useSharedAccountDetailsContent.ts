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
import { useAllAccounts } from '@perawallet/wallet-core-accounts'

type UseSharedAccountDetailsContentResult = {
    isUserIncluded: boolean
}

/**
 * Derives whether one of the user's own wallet accounts is a participant of
 * the shared account, so the detail sheet can show the "You included" label.
 */
export const useSharedAccountDetailsContent = (
    addresses: string[],
): UseSharedAccountDetailsContentResult => {
    const accounts = useAllAccounts()

    const isUserIncluded = useMemo(() => {
        const participantSet = new Set(addresses)
        return accounts.some(a => participantSet.has(a.address))
    }, [accounts, addresses])

    return { isUserIncluded }
}
