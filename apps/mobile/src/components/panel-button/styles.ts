import { makeStyles } from '@rneui/themed';
import { PanelButtonProps } from './PanelButton';

export const useStyles = makeStyles((theme, props: PanelButtonProps) => ({
  buttonStyle: {
    height: 60,
    gap: theme.spacing.md,
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.layerGrayLighter,
    color: theme.colors.textMain,
    borderRadius: theme.spacing.lg
  },
  textStyle: {
    backgroundColor: theme.colors.layerGrayLighter,
    color: theme.colors.textMain,
    flexGrow: 1,
    height: 28,
  }
}));
