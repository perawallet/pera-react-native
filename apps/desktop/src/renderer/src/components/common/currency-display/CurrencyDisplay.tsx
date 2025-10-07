import Decimal from 'decimal.js';

export type CurrencyDisplayProps = {
  currency: string;
  value: Decimal;
  precision: number;
  prefix?: string;
  alignRight?: boolean;
  showSymbol?: boolean;
  skeleton?: boolean;
  units?: 'K' | 'M';
  h1?: boolean;
  h4?: boolean;
  className?: string;
};

const formatCurrency = (
  value: Decimal,
  precision: number,
  currency: string,
  locale: string,
  showSymbol: boolean,
  units?: 'K' | 'M'
): string => {
  let displayValue = value.toFixed(precision);
  if (units === 'K') displayValue = (value.div(1000)).toFixed(precision) + 'K';
  if (units === 'M') displayValue = (value.div(1000000)).toFixed(precision) + 'M';
  return new Intl.NumberFormat(locale).format(parseFloat(displayValue));
};

const CurrencyDisplay = (props: CurrencyDisplayProps) => {
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
    className,
  } = props;

  const isAlgo = currency === 'ALGO';

  const displayValue = formatCurrency(
    value,
    precision,
    currency,
    'en-US', // default locale
    showSymbol,
    units,
  );

  if (skeleton) {
    return <div className={`animate-pulse bg-gray-300 h-6 w-20 rounded ${className || ''}`}></div>;
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
  );
};

export default CurrencyDisplay;
