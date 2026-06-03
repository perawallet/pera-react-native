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

import {
    BOTTOM_TAB_LABEL_FONT_SIZE,
    BOTTOM_TAB_LABEL_LINE_HEIGHT,
} from '@constants/ui'
import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => {
    const active = {
        color: theme.colors.textMain,
        fontWeight: 'medium' as const,
        fontSize: BOTTOM_TAB_LABEL_FONT_SIZE,
        lineHeight: BOTTOM_TAB_LABEL_LINE_HEIGHT,
    }
    const inactive = {
        color: theme.colors.textGray,
        fontWeight: 'normal' as const,
        fontSize: BOTTOM_TAB_LABEL_FONT_SIZE,
        lineHeight: BOTTOM_TAB_LABEL_LINE_HEIGHT,
    }
    return {
        container: {
            width: '100%',
            alignItems: 'center',
            overflow: 'hidden',
            minWidth: 0,
        },
        label: {
            textAlign: 'center',
            width: '100%',
            minWidth: 0,
            flexShrink: 1,
        },
        active,
        inactive,
    }
})
