import colors from "material-colors";
import Colors from "material-colors";
import { PropsWithChildren } from "react";
import { StyleProp, StyleSheet, View, ViewStyle, useColorScheme } from "react-native";
import { Text, useTheme } from "react-native-paper";

const styles = StyleSheet.create({
	sectionContainer: {
		marginVertical: 32,
		paddingHorizontal: 24,
	},
	sectionTitle: {
		fontSize: 28,
		fontWeight: "600",
	},
	sectionDescription: {
		marginTop: 8,
		fontSize: 18,
		fontWeight: "400",
	},
});

type SectionProps = PropsWithChildren<{
	title: string;
	style?: ViewStyle;
}>;

export function Section({ children, title, style }: SectionProps): JSX.Element {
	const theme = useTheme();

	return (
		<View style={[styles.sectionContainer, style]}>
			<Text style={[styles.sectionTitle, { color: colors.white }]}>{title}</Text>
			<Text style={[styles.sectionDescription]}>{children}</Text>
		</View>
	);
}
