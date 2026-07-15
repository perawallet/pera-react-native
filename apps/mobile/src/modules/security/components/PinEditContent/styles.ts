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
    container: {
        // Top only: PinEditView already clears the bottom safe area itself,
        // and the sheet adds its own bottom padding — padding here would
        // stack up and push the numpad into the PIN circles.
        paddingTop: theme.spacing.xl,
        flex: 1,
    },
    toolbar: {
        minHeight: 0,
        paddingBottom: theme.spacing.xl,
        paddingTop: 0,
    },
}))
