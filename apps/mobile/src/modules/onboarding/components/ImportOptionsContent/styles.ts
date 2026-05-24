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

export const useStyles = makeStyles(theme => ({
    content: {
        paddingHorizontal: theme.spacing.xl,
        width: '100%',
    },
    optionsContainer: {
        gap: theme.spacing.md,
        marginTop: theme.spacing.lg,
        paddingBottom: theme.spacing.lg,
        width: '100%',
    },
    optionBox: {
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
        borderRadius: theme.spacing.lg,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        width: '100%',
        minWidth: 0,
        overflow: 'hidden',
    },
    optionContent: {
        flex: 1,
        minWidth: 0,
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
    },
    optionTopContent: {
        gap: theme.spacing.xs,
        width: '100%',
        minWidth: 0,
    },
    optionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        width: '100%',
        minWidth: 0,
    },
    optionTitleContainer: {
        flexShrink: 1,
        minWidth: 0,
    },
    optionChipContainer: {
        flexShrink: 0,
    },
    optionBody: {
        color: theme.colors.textGray,
    },
    optionLink: {
        color: theme.colors.positive,
    },
    rightIconContainer: {
        width: theme.spacing.xxl,
        height: theme.spacing.xxl,
        borderRadius: theme.spacing.lg,
        backgroundColor: theme.colors.layerGrayLighter,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
}))
