import { useStyles } from './styles'
import ExpandableText from '../../../common/expandable-text/ExpandableText'
import { Text } from '@rneui/themed'
import PWView from '../../../common/view/PWView'

type AssetDescriptionProps = {
    description?: string
}

const AssetDescription = ({ description }: AssetDescriptionProps) => {
    const styles = useStyles()

    if (!description) {
        return null
    }

    return (
        <PWView style={styles.container}>
            <Text style={styles.title}>Description</Text>
            <ExpandableText text={description} />
        </PWView>
    )
}

export default AssetDescription
