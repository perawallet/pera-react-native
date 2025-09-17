import { makeStyles } from '@rneui/themed';
import { PeraViewProps } from './PeraView';

export const useStyles = makeStyles((theme, _: PeraViewProps) => ({
  defaultStyle: {
    backgroundColor: theme.colors.background,
  },
}));
