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

const BULLET_SIZE = 24

export const useStyles = makeStyles(theme => ({
    container: {
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xl,
    },
    title: {
        marginBottom: theme.spacing.lg,
    },
    list: {
        gap: theme.spacing.md,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.md,
    },
    bullet: {
        width: BULLET_SIZE,
        height: BULLET_SIZE,
        borderRadius: BULLET_SIZE / 2,
        backgroundColor: theme.colors.positiveLighter,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemText: {
        flex: 1,
        color: theme.colors.textMain,
    },
}))
