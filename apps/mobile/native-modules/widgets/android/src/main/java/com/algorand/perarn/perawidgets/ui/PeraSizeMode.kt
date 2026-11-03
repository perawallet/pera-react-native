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
package com.algorand.perarn.perawidgets.ui

import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.glance.appwidget.SizeMode

// Responsive, not Exact: Exact hands the launcher one landscape (max width × min height) and one portrait
// render to choose from, and ColorOS shows the landscape one on a portrait home screen, so a 2x2 drew as a
// wide, short widget. Here the host picks the largest of these that fits the widget's real bounds, so the
// steps around a 2x2 are tight: a ColorOS 2x2 is about 146 × 137dp, and a step it can't fit drops it to 110.
val PeraSizeMode = SizeMode.Responsive(
    setOf(
        DpSize(110.dp, 110.dp),
        DpSize(130.dp, 120.dp),
        DpSize(140.dp, 130.dp),
        DpSize(150.dp, 140.dp),
        DpSize(160.dp, 150.dp),
        DpSize(180.dp, 170.dp),
        DpSize(140.dp, 250.dp),
        DpSize(250.dp, 110.dp),
        DpSize(250.dp, 140.dp),
        DpSize(300.dp, 140.dp),
        DpSize(300.dp, 180.dp),
        DpSize(320.dp, 250.dp),
    ),
)
