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

type StyleProps = {
    isImported: boolean
}

export const useStyles = makeStyles((theme, { isImported }: StyleProps) => ({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadius.md,
        borderWidth: theme.borders.md,
        borderColor: theme.colors.layerGrayLighter,
        opacity: isImported ? 0.6 : 1,
        marginBottom: theme.spacing.md,
        gap: theme.spacing.md,
    },
    checkbox: {
        margin: 0,
        padding: 0,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        color: theme.colors.textMain,
    },
    subtitle: {
        color: theme.colors.textGray,
    },
    infoButton: {
        padding: theme.spacing.xs,
    },
}))
