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

import Decimal from 'decimal.js'

export type CurrencyDisplayProps = {
  currency: string
  value: Decimal
  precision: number
  prefix?: string
  alignRight?: boolean
  showSymbol?: boolean
  skeleton?: boolean
  units?: 'K' | 'M'
  h1?: boolean
  h4?: boolean
  className?: string
}

const formatCurrency = (
  value: Decimal,
  precision: number,
  locale: string,
  units?: 'K' | 'M'
): string => {
  let displayValue = value.toFixed(precision)
  if (units === 'K') displayValue = value.div(1000).toFixed(precision) + 'K'
  if (units === 'M') displayValue = value.div(1000000).toFixed(precision) + 'M'
  return new Intl.NumberFormat(locale).format(parseFloat(displayValue))
}

const CurrencyDisplay = (props: CurrencyDisplayProps): React.ReactElement => {
  const {
    currency,
    value,
    precision,
    prefix,
    units,
    showSymbol = true,
    skeleton = false,
    h1,
    h4,
    className
  } = props

  const isAlgo = currency === 'ALGO'

  const displayValue = formatCurrency(
    value,
    precision,
    'en-US', // default locale
    units
  )

  if (skeleton) {
    return <div className={`animate-pulse bg-gray-300 h-6 w-20 rounded ${className || ''}`}></div>
  }

  return (
    <div className={`flex items-center ${className || ''}`}>
      {isAlgo && showSymbol && <span className="mr-1">₳</span>}
      <span className={`${h1 ? 'text-3xl font-bold' : h4 ? 'text-lg' : 'text-base'}`}>
        {prefix || ''}
        {displayValue}
        {units}
      </span>
    </div>
  )
}

export default CurrencyDisplay
