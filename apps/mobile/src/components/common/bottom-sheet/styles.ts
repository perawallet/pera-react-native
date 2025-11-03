import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles((theme) => ({
  defaultStyle: {
    backgroundColor: theme.colors.background,
    borderTopStartRadius: theme.spacing.xl,
    borderTopEndRadius: theme.spacing.xl
  },
}));
