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
        flex: 1,
        backgroundColor: theme.colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.xl,
        gap: theme.spacing.xl,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
    },
    dotsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: theme.spacing.xl,
        gap: theme.spacing.md,
    },
    dot: {
        width: theme.spacing.xs,
        height: theme.spacing.xs,
        borderRadius: theme.spacing.xs,
    },
    dot1: {
        backgroundColor: theme.colors.grey2, // Gray 200
    },
    dot2: {
        backgroundColor: theme.colors.grey4, // Gray 400
    },
    dot3: {
        backgroundColor: theme.colors.grey5, // Gray 600
    },
    dot4: {
        backgroundColor: theme.colors.black, // Gray 800
    },
    title: {
        textAlign: 'center',
    },
}))
