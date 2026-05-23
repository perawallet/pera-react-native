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

export const useStyles = makeStyles(theme => {
    const secondaryText = {
        color: theme.colors.textGray,
        lineHeight: theme.spacing.lg,
    }
    return {
        addressValueContainer: {
            flexDirection: 'row',
            gap: theme.spacing.md,
            alignItems: 'center',
            flex: 1,
            minWidth: 0,
        },
        contentContainer: {
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
        },
        copyIconContainer: {
            flexShrink: 0,
        },
        contactContainer: {
            flexDirection: 'row',
            gap: theme.spacing.md,
            alignItems: 'center',
            minWidth: 0,
            flex: 1,
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
        foreignAvatar: {
            width: theme.spacing.xxl,
            height: theme.spacing.xxl,
            borderRadius: theme.spacing.xxl,
            backgroundColor: theme.colors.wallet1Icon,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
        },
    }
})
