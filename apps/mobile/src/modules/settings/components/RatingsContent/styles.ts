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

type StyleProps = { bottomInset: number }

export const useStyles = makeStyles((theme, { bottomInset }: StyleProps) => ({
    bottomSheetContainer: {
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.xl,
        paddingBottom: theme.spacing.xl + bottomInset,
        width: '100%',
        minWidth: 0,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: theme.spacing['3xl'],
        marginTop: theme.spacing.xl,
        width: '100%',
    },
    bottomSheetMessage: {
        textAlign: 'center',
        color: theme.colors.textGray,
        width: '100%',
        minWidth: 0,
    },
    title: {
        textAlign: 'center',
        width: '100%',
        minWidth: 0,
    },
}))
