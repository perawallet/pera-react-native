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

export const useStyles = makeStyles(theme => ({
    scrollContent: {
        flexGrow: 1,
    },
    heroSection: {
        backgroundColor: theme.colors.modalityBg,
    },
    heroImage: {
        width: '100%',
        aspectRatio: 1.4,
    },
    contentSection: {
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.xxl,
        gap: theme.spacing.lg,
        width: '100%',
        minWidth: 0,
    },
    title: {
        color: theme.colors.textMain,
    },
    description: {
        color: theme.colors.textGray,
        marginBottom: theme.spacing.xl,
    },
    poweredBy: {
        color: theme.colors.textGrayLighter,
        textAlign: 'center',
    },
    poweredByBrand: {
        color: theme.colors.primary,
    },
    startButton: {
        marginTop: theme.spacing.xs,
    },
    termsText: {
        color: theme.colors.textGray,
        textAlign: 'center',
        paddingHorizontal: theme.spacing['3xl'],
    },
}))
