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

import { PeraCardActivateRow } from './PeraCardActivateRow'
import { PeraCardConnectedRow } from './PeraCardConnectedRow'

export type PeraCardAccountItemProps = {
    /** True once the wallet has a Pera Card (Baanx) session. */
    activated: boolean
    /** True when the activated card nests under its connected funding account. */
    nested: boolean
    /** Fired when the Activate button is tapped; the host closes the menu and navigates. */
    onActivate?: () => void
    /** Fired when an activated card row is tapped; the host closes the menu and opens the card. */
    onOpen?: () => void
}

export const PeraCardAccountItem = ({
    activated,
    nested,
    onActivate,
    onOpen,
}: PeraCardAccountItemProps) => {
    return activated ? (
        <PeraCardConnectedRow
            nested={nested}
            onPress={onOpen}
        />
    ) : (
        <PeraCardActivateRow onActivate={onActivate} />
    )
}
