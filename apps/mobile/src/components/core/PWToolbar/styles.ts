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
    paddingStyle?: 'dense' | 'normal' | 'none'
    // When a center slot is present, the left/right slots grow equally so the
    // center stays on true screen-center regardless of side content; otherwise
    // they hug their content (e.g. the account toolbar's wide selector).
    hasCenter: boolean
}

export const useStyles = makeStyles(
    (theme, { paddingStyle, hasCenter }: StyleProps) => {
        const sideSlot = hasCenter
            ? { flexGrow: 1, flexBasis: 0, flexShrink: 1 }
            : { flexShrink: 1, maxWidth: '60%' as const }
        return {
            container: {
                alignSelf: 'flex-start',
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: theme.spacing.md,
                paddingVertical: paddingStyle === 'none' ? 0 : theme.spacing.md,
                minHeight: paddingStyle === 'normal' ? theme.spacing['4xl'] : 0,
            },
            leftSlotContainer: {
                ...sideSlot,
                alignSelf: 'flex-start',
                alignItems: 'flex-start',
                minWidth: 0,
                overflow: 'hidden',
            },
            centerSlotContainer: {
                alignSelf: 'flex-start',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 1,
                minWidth: 0,
                ...(hasCenter ? null : { flexGrow: 1 }),
            },
            rightSlotContainer: {
                ...sideSlot,
                alignSelf: 'flex-start',
                flexDirection: 'row',
                justifyContent: 'flex-end',
                alignItems: 'center',
                minWidth: 0,
            },
        }
    },
)
