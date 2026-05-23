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

const IMAGE_SIZE = 160

export const useStyles = makeStyles(theme => ({
    content: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        paddingTop: theme.spacing.xl,
    },
    image: {
        width: IMAGE_SIZE,
        height: IMAGE_SIZE,
    },
    warningRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.sm,
    },
    warning: {
        flex: 1,
        textAlign: 'left',
        color: theme.colors.negative,
    },
    footerInner: {
        gap: theme.spacing.lg,
    },
}))
