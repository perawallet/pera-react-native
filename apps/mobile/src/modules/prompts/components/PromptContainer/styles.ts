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

export const useStyles = makeStyles((theme, insets: EdgeInsets) => ({
    // Full-screen, opaque, inline overlay — deliberately NOT a native <Modal>.
    // A Modal is a separate OS window whose content is laid out by the same
    // Yoga tree: an ancestor toggling `display: none` (AutoLockGuard) zeroes
    // its content while the window stays up, and unmounting it mid-present
    // animation can leave the window behind. Either way the app renders
    // normally and swallows every touch.
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: theme.zIndex.max,
        backgroundColor: theme.colors.background,
    },
    // Carries the entrance animation. Separate from `overlay` so the backdrop
    // stays opaque from the first frame: fading the backdrop in would show the
    // app underneath mid-reveal and read as still interactive, which is exactly
    // what a gate must not do.
    revealLayer: {
        flex: 1,
    },
    // No-op on native; styles.web.ts overrides this to cap the overlay to the
    // app's expanded-tab card width (see that file's comment).
    stage: {
        flex: 1,
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
