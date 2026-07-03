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

type StyleProps = { bottomInset: number }

export const useStyles = makeStyles((theme, { bottomInset }: StyleProps) => ({
    container: {
        alignItems: 'center',
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.xxl,
        paddingBottom: theme.spacing.xl + bottomInset,
        gap: theme.spacing.lg,
    },
    title: {
        textAlign: 'center',
    },
    body: {
        textAlign: 'center',
        color: theme.colors.textGray,
    },
    actions: {
        width: '100%',
        gap: theme.spacing.md,
        marginTop: theme.spacing.sm,
    },
}))
