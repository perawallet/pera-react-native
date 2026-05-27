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
    // Standard sheet-header gutter — matches the sheet body's horizontal
    // padding (lg) so the header lines up with the content beneath it. Callers
    // pass `style` to override (e.g. full-bleed headers using 0).
    toolbar: {
        paddingHorizontal: theme.spacing.lg,
    },
    title: {
        width: '100%',
        textAlign: 'center',
    },
    // Title + subtitle stack (e.g. account name over its truncated address).
    titleColumn: {
        width: '100%',
        alignItems: 'center',
    },
    subtitle: {
        width: '100%',
        textAlign: 'center',
        color: theme.colors.textGrayLighter,
    },
}))
