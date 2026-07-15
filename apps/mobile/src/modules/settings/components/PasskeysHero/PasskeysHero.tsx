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

import PasskeysHeroLight from '@assets/icons/passkey-hero-light.svg'
import PasskeysHeroDark from '@assets/icons/passkey-hero-dark.svg'
import { useIsDarkMode } from '@hooks/useIsDarkMode'

/**
 * Multicolor brand illustration used in the Settings → Passkeys empty and
 * disabled states. The light / dark variants are separate SVG assets because
 * the artwork uses fixed brand colors (teal palette) plus a theme-dependent
 * outer ring tint that `currentColor` can't address from a single file.
 */
export const PasskeysHero = () => {
    const isDarkMode = useIsDarkMode()
    const Hero = isDarkMode ? PasskeysHeroDark : PasskeysHeroLight
    return (
        <Hero
            width={96}
            height={88}
        />
    )
}
