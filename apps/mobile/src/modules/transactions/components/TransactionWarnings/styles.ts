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
    return {
        warningContainer: {
            alignItems: 'center',
            justifyContent: 'flex-start',
            width: '100%',
            marginBottom: theme.spacing.md,
        },
        sheetContainer: {
            paddingBottom: theme.spacing.xxl,
            paddingHorizontal: theme.spacing.xl,
            borderTopStartRadius: theme.spacing.sm,
            borderTopEndRadius: theme.spacing.sm,
            overflow: 'hidden',
        },
        warningSection: {
            marginVertical: theme.spacing.md,
            gap: theme.spacing.xs,
        },
        warningSectionIconContainer: {
            flexShrink: 1,
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            gap: theme.spacing.lg,
        },
        warningSectionAddressContainer: {
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: theme.spacing.md,
        },
        warningMessageContainer: {
            flexShrink: 1,
            gap: theme.spacing.xs,
        },
        warningMessage: {
            flexShrink: 1,
        },
        warningLinkContainer: {
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            gap: theme.spacing.xs,
            marginHorizontal: theme.spacing.lg,
            padding: theme.spacing.md,
            borderRadius: theme.spacing.md,
            backgroundColor: theme.colors.asaSuspiciousBg,
        },
        warningTitleContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: theme.spacing.md,
            backgroundColor: 'transparent',
        },
        warningLink: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: theme.spacing.md,
        },
        divider: {
            marginVertical: theme.spacing.md,
            width: '100%',
        },
        warningTitle: {
            color: theme.colors.asaSuspiciousText,
            backgroundColor: 'transparent',
        },
    }
})
