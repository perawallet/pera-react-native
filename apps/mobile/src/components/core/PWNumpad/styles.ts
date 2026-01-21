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

const KEY_SIZE = theme.spacing['4xl']
const KEY_SPACING = theme.spacing.xl

export const useStyles = makeStyles(theme => ({
    container: {
        width: '100%',
        alignItems: 'center',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: KEY_SPACING,
    },
    key: {
        width: KEY_SIZE,
        height: KEY_SIZE * 0.8,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: KEY_SPACING * 0.7,
    },
    keyDisabled: {
        opacity: 0.5,
    },
    keyPlaceholder: {
        width: KEY_SIZE,
        height: KEY_SIZE,
        marginHorizontal: KEY_SPACING / 2,
        backgroundColor: 'transparent',
    },
    keyText: {
        color: theme.colors.textMain,
    },
    keyTextDisabled: {
        color: theme.colors.textGray,
    },
}))
