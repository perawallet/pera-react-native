import { makeStyles } from '@rneui/themed';
import { PeraButtonProps } from './PeraButton';

export const useStyles = makeStyles((theme, props: PeraButtonProps) => ({
  buttonStyle: {
    backgroundColor:
      props.variant === 'primary'
        ? theme.colors.background
        : theme.colors.grey0,
    color:
      props.variant === 'primary'
        ? theme.colors.primary
        : theme.colors.secondary,
  },
}));
