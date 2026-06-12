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

import { makeStyles } from '@rneui/themed'

type StyleProps = {
    hugContent: boolean
}

export const useStyles = makeStyles((theme, { hugContent }: StyleProps) => {
    const secondaryText = {
        color: theme.colors.textGray,
        // No dedicated line-height token exists; theme.spacing.lg (16) is
        // reused as the caption line height to keep pixel-parity with the
        // secondary text in AccountDisplay/styles.ts.
        lineHeight: theme.spacing.lg,
    }
    const fillOrHug = hugContent ? { flexShrink: 1 } : { flex: 1 }
    return {
        addressValueContainer: {
            flexDirection: 'row',
            gap: theme.spacing.md,
            alignItems: 'center',
            minWidth: 0,
            ...fillOrHug,
        },
        contentContainer: {
            minWidth: 0,
            overflow: 'hidden',
            ...fillOrHug,
        },
        copyIconContainer: {
            flexShrink: 0,
        },
        contactContainer: {
            flexDirection: 'row',
            gap: theme.spacing.md,
            alignItems: 'center',
            minWidth: 0,
            ...fillOrHug,
        },
        unifiedTextContainer: {
            flex: 1,
            minWidth: 0,
            justifyContent: 'center',
        },
        addressTextStack: {
            flex: 1,
            minWidth: 0,
            justifyContent: 'center',
        },
        primaryText: {
            color: theme.colors.textMain,
        },
        secondaryText,
    }
})
