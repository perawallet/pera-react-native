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

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path

// RemoteViews cannot host a chart, so it is drawn into a bitmap sized to the slot it fills.
object Sparkline {
    fun bitmap(values: List<Double>, widthPx: Int, heightPx: Int, color: Int, strokePx: Float): Bitmap {
        val bitmap = Bitmap.createBitmap(widthPx.coerceAtLeast(1), heightPx.coerceAtLeast(1), Bitmap.Config.ARGB_8888)
        if (values.size < 2) return bitmap
        val min = values.min()
        val max = values.max()
        val range = (max - min).takeIf { it > 0 } ?: 1.0
        val inset = strokePx
        val usableW = widthPx - 2 * inset
        val usableH = heightPx - 2 * inset
        val points = values.mapIndexed { i, v ->
            val x = inset + usableW * i / (values.size - 1)
            // A flat series sits mid-height rather than on the bottom edge.
            val y = if (max == min) heightPx / 2f else inset + usableH * (1 - ((v - min) / range)).toFloat()
            x to y
        }
        val path = Path().apply {
            moveTo(points[0].first, points[0].second)
            for (i in 1 until points.size) {
                val (px, py) = points[i - 1]
                val (cx, cy) = points[i]
                val mid = (px + cx) / 2
                cubicTo(mid, py, mid, cy, cx, cy)
            }
        }
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
            style = Paint.Style.STROKE
            strokeWidth = strokePx
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
        }
        Canvas(bitmap).drawPath(path, paint)
        return bitmap
    }
}
