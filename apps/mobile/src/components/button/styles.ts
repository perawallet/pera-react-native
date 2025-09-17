import { makeStyles } from '@rneui/themed';
import { PeraButtonProps } from './PeraButton';

export const useStyles = makeStyles((theme, props: PeraButtonProps) => ({
  buttonStyle: {
    backgroundColor:
      props.variant === 'primary'
        ? theme.colors.buttonPrimaryBg
        : theme.colors.secondary,
  },
  titleStyle: {
    fontFamily: 'DMSans-Regular',
    fontWeight: '500',
    fontSize: 15,
    lineHeight: 24,
    color:
      props.variant === 'primary'
        ? theme.colors.buttonPrimaryText
        : theme.colors.textMain,
  },
}));
