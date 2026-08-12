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
    // The overlay fills its mount point in the web shell, which is wider than
    // the app's expanded-tab card — cap it so the prompt matches the card the
    // rest of the UI is painted into. No-op in the popup, which is already
    // narrower than the cap.
    stage: {
        flex: 1,
        width: '100%',
        maxWidth: WEB_EXPANDED_CARD_MAX_WIDTH,
        alignSelf: 'center' as const,
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
