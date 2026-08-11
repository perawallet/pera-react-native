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

import { type ViewStyle } from 'react-native'
import { type SvgProps } from 'react-native-svg'

import {
    type AccountType,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { PWRoundIcon, type PWRoundIconSize } from '@components/core/PWRoundIcon'
import { useAccountIcon, type AccountDisplayState } from './useAccountIcon'

export type { AccountDisplayState } from './useAccountIcon'

export type AccountIconSize = 'sm' | 'md' | 'lg' | 'xl'

export type AccountIconProps = {
    account?: WalletAccount
    size?: AccountIconSize
    /**
     * When true, render the icon for the account's base `type` and ignore
     * its rekey state.
     */
    ignoreRekey?: boolean
    /**
     * Force the display state. Use for accounts not yet in the store
     * (e.g. import previews).
     */
    displayState?: AccountDisplayState
    /**
     * Type of the auth account, for a forced `displayState` on a synthetic
     * account whose auth address is not in the store yet.
     */
    authType?: AccountType
    // Extends SvgProps for source-compat with existing call sites, but only
    // `style` and `testID` are forwarded to PWRoundIcon; other SvgProps
    // (color/fill/width/onPress) are intentionally ignored — the account
    // glyphs are self-colored, so a tint/color prop was already a no-op.
} & SvgProps

// Account icons have two Figma formats: small (24px circle) and large (40px).
// All non-small sizes resolve to the large format.
const ACCOUNT_SIZE_MAP: Record<AccountIconSize, PWRoundIconSize> = {
    sm: 'sm',
    md: 'md',
    lg: 'md',
    xl: 'md',
}

export const AccountIcon = (props: AccountIconProps) => {
    const {
        account,
        size = 'md',
        ignoreRekey,
        displayState,
        authType,
        style,
        testID,
    } = props
    const glyph = useAccountIcon(account, {
        ignoreRekey,
        displayState,
        authType,
    })

    if (!glyph) return <></>

    return (
        <PWRoundIcon
            icon={glyph.name}
            variant={glyph.variant}
            size={ACCOUNT_SIZE_MAP[size]}
            style={style as ViewStyle}
            testID={testID}
        />
    )
}
