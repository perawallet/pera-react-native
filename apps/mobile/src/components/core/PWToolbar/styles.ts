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

export const useStyles = makeStyles(
    (theme, paddingStyle: 'dense' | 'normal' | 'none') => ({
        container: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: theme.spacing.md,
            paddingVertical: paddingStyle === 'none' ? 0 : theme.spacing.md,
            minHeight: paddingStyle === 'normal' ? theme.spacing['4xl'] : 0,
        },
        leftSlotContainer: {
            alignItems: 'flex-start',
            flexShrink: 1,
            minWidth: 0,
            maxWidth: '60%',
            overflow: 'hidden',
        },
        centerSlotContainer: {
            alignItems: 'center',
            justifyContent: 'center',
            flexGrow: 1,
            flexShrink: 1,
            minWidth: 0,
        },
        rightSlotContainer: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            alignItems: 'center',
            flexShrink: 1,
            minWidth: 0,
            maxWidth: '60%',
            overflow: 'hidden',
        },
    }),
)
