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
        alignItems: 'flex-start',
        gap: theme.spacing.md,
        width: '100%',
    },
    idContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xl,
    },
    idTextContainer: {
        alignItems: 'flex-start',
        gap: theme.spacing.sm,
    },
    wrappedText: {
        flexShrink: 1,
        lineHeight: theme.spacing.lg,
    },
    blockContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: theme.spacing.lg,
        paddingHorizontal: theme.spacing.sm,
    },
    blockColumn: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.sm,
    },
    blockTitle: {
        color: theme.colors.textGray,
    },
    blockValue: {
        color: theme.colors.textMain,
    },
}))
