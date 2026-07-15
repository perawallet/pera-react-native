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

import { useTheme } from '@rneui/themed'
import { getIconPixelSize, type PWIconSize, PWImage } from '@components/core'
import { useStyles } from './styles'

// Round country-flag SVGs keyed by ISO 3166-1 alpha-2 code, matching the set
// the web onramp uses. Unicode flag emoji can't fill a circular container
// (they're small rectangular glyphs), so we render a true round flag image.
const CIRCLE_FLAGS_BASE_URL = 'https://hatscripts.github.io/circle-flags/flags'

/** Round-flag SVG URL for an ISO 3166-1 alpha-2 country code (e.g. "US"). */
export const getCircleFlagUrl = (countryCode: string): string =>
    `${CIRCLE_FLAGS_BASE_URL}/${countryCode.toLowerCase()}.svg`

export type CircleFlagProps = {
    /** ISO 3166-1 alpha-2 country code (e.g. "US", "DE"). */
    countryCode: string
    /** Matches the icon size scale so flags align with token icons. */
    size?: PWIconSize
}

export const CircleFlag = ({ countryCode, size = 'md' }: CircleFlagProps) => {
    const { theme } = useTheme()
    const styles = useStyles()
    const pixelSize = getIconPixelSize(theme, size)

    return (
        <PWImage
            source={{
                uri: getCircleFlagUrl(countryCode),
            }}
            width={pixelSize}
            height={pixelSize}
            resizeMode='cover'
            style={styles.flag}
            transition={false}
        />
    )
}
