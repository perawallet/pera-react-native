import { makeStyles } from '@rneui/themed';
import { CurrencyDisplayProps } from './CurrencyDisplay';

export const useStyles = makeStyles((theme, _: CurrencyDisplayProps) => ({
  container: {
    gap: theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
}));
