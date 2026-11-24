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

import { useEffect, useRef } from 'react'
import { wipeMigratedLegacyData } from '@perawallet/wallet-core-migrate'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { ALGORAND_CHAIN_ID } from '@modules/algorand/chain-id'

export type UseLegacyDataWipeArgs = {
    isEnabled: boolean
}

// Fires once the migration gate clears, including straight after a migration
// finishes in this session.
export const useLegacyDataWipe = ({ isEnabled }: UseLegacyDataWipeArgs) => {
    const hasRunRef = useRef(false)

    useEffect(() => {
        if (!isEnabled || hasRunRef.current) return
        hasRunRef.current = true
        void wipeMigratedLegacyData(getProvider().migration, ALGORAND_CHAIN_ID)
    }, [isEnabled])
}
