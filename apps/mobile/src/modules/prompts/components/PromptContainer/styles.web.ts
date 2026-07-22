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
    modal: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    // react-native-web's Modal portals straight to document.body with
    // position: fixed; inset: 0 (see PWBottomSheet's styles.web.ts for the
    // full explanation), which puts this prompt's DOM entirely outside
    // AppShell.web.tsx's width-capped card — this re-applies that same cap
    // so the prompt doesn't fill the whole expanded-tab width. No-op in the
    // popup, which is already narrower than the cap.
    stage: {
        flex: 1,
        width: '100%',
        maxWidth: WEB_EXPANDED_CARD_MAX_WIDTH,
        alignSelf: 'center' as const,
    },
    root: {
        flex: 1,
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
