import { makeStyles } from '@rneui/themed';
import { PeraButtonProps } from './PeraButton';

export const useStyles = makeStyles((theme, props: PeraButtonProps) => {
  let backgroundColor = theme.colors.buttonPrimaryBg
  let color = theme.colors.buttonPrimaryText

  if (props.variant === 'secondary') {
    backgroundColor = theme.colors.secondary
    color = theme.colors.textMain
  } else if (props.variant === 'tertiary') {
    backgroundColor = theme.colors.layerGrayLighter
    color = theme.colors.textMain
  }

  return {
    buttonStyle: {
      backgroundColor,
      gap: theme.spacing.sm,
    },
    titleStyle: {
      fontFamily: 'DMSans-Medium',
      fontWeight: '500',
      fontSize: 15,
      lineHeight: 24,
      color,
    },
  }
});
