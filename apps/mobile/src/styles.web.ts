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
import { WEB_EXPANDED_CARD_MAX_WIDTH } from '@constants/ui'

// Theme-aware paint for the whole app area, below ThemeProvider so it sees
// in-app overrides; build.mjs's global CSS is only the pre-mount fallback.
// `card` caps content to a popup-like width: the UI was designed for a 360px
// popup. PWBottomSheet.web applies the same cap, since gorhom-on-web portals to document.body.
export const useAppShellRootStyles = makeStyles(theme => ({
    root: {
        flex: 1,
        backgroundColor: theme.colors.layerGrayLighter,
    },
    card: {
        flex: 1,
        width: '100%',
        maxWidth: WEB_EXPANDED_CARD_MAX_WIDTH,
        alignSelf: 'center',
        backgroundColor: theme.colors.background,
    },
}))

export const useApprovalPlaceholderStyles = makeStyles(() => ({
    container: {
        flex: 1,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
    },
}))
