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
    container: {
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing['4xl'],
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing.lg,
    },
    closeButton: {
        position: 'absolute',
        left: 0,
    },
    optionsContainer: {
        gap: theme.spacing.md,
        marginTop: theme.spacing.lg,
    },
    optionBox: {
        borderWidth: 1,
        borderColor: theme.colors.layerGray,
        borderRadius: theme.spacing.lg,
        paddingHorizontal: theme.spacing.xl,
        paddingVertical: theme.spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    optionContent: {
        flex: 1,
        justifyContent: 'space-between',
        gap: theme.spacing.lg,
    },
    optionTopContent: {
        gap: theme.spacing.xs,
        maxWidth: '80%',
    },
    optionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    optionBody: {
        color: theme.colors.textGray,
    },
    optionLink: {
        color: theme.colors.linkPrimary,
    },
    rightIconContainer: {
        width: theme.spacing.xxl,
        height: theme.spacing.xxl,
        borderRadius: theme.spacing.lg,
        backgroundColor: theme.colors.layerGrayLighter,
        alignItems: 'center',
        justifyContent: 'center',
    },
}))
