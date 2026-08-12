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

import type { Optional } from '@perawallet/wallet-core-shared'

/**
 * The dApp icon to show for a WC peer: raster formats first (expo-image
 * renders them reliably everywhere; dApp svg icons are a coin flip), else
 * whatever the dApp listed first.
 */
export const getPreferredDappIcon = (
    icons: Optional<string[]>,
): Optional<string> =>
    icons?.find(
        icon =>
            icon.endsWith('.png') ||
            icon.endsWith('.jpg') ||
            icon.endsWith('.jpeg'),
    ) ?? icons?.at(0)
