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

import { makeStyles } from '@rneui/themed'
import { type EdgeInsets } from 'react-native-safe-area-context'
import { WEB_EXPANDED_CARD_MAX_WIDTH } from '@constants/ui'

export const useStyles = makeStyles((theme, insets: EdgeInsets) => ({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: theme.zIndex.max,
        backgroundColor: theme.colors.background,
    },
    // Must exist here too: this file replaces the native style object outright
    // rather than merging with it, so a key missing here is missing on web.
    revealLayer: {
        flex: 1,
    },
    // Defence in depth: the mount point already sits inside AppShell's capped
    // card, so this cap is inert today — it only bites if the overlay is ever
    // remounted outside the card (as the removed RNW Modal portal was).
    stage: {
        flex: 1,
        width: '100%',
        maxWidth: WEB_EXPANDED_CARD_MAX_WIDTH,
        alignSelf: 'center' as const,
    },
    // Full-bleed variant: a prompt whose own art covers the surface insets its
    // chrome itself, so container padding would only frame it.
    containerFullBleed: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    container: {
        flex: 1,
        paddingRight: insets.right,
        paddingLeft: insets.left,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        backgroundColor: theme.colors.background,
    },
}))
