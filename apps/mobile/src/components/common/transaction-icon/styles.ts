import { makeStyles } from '@rneui/themed';
import { TransactionIconProps } from './TransactionIcon';

export const useStyles = makeStyles((theme, props: TransactionIconProps) => {
  const padding = theme.spacing.lg;
  const size =
    (props.size === 'small' ? theme.spacing.xl : theme.spacing.xl * 2) +
    2 * padding;
  return {
    container: {
      backgroundColor: theme.colors.layerGrayLighter,
      borderRadius: '50%',
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: {},
  };
});
