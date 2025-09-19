import { makeStyles } from '@rneui/themed';
import { RoundButtonProps } from './RoundButton';

export const useStyles = makeStyles((theme, _: RoundButtonProps) => ({
  buttonStyle: {
    backgroundColor: theme.colors.layerGrayLighter,
    color: theme.colors.textMain,
    marginBottom: theme.spacing.sm,
    width: 64,
    height: 64,
    alignContent: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 32,
  },
  titleStyle: {
    color: theme.colors.textMain,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
}));
