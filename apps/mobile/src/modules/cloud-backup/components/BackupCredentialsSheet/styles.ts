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
    body: {
        gap: theme.spacing.xl,
    },
    section: {
        gap: theme.spacing.sm,
    },
    label: {
        color: theme.colors.textGray,
    },
    loading: {
        paddingVertical: theme.spacing.xxl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorText: {
        color: theme.colors.textGray,
    },
    copyLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
    },
    copyLinkText: {
        color: theme.colors.positive,
    },
}))
