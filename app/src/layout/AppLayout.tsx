import colors from "material-colors";
import React, { useContext } from "react";
import { ScrollView, View } from "react-native";
import { Appbar, Avatar, MD3Theme, useTheme as usePaperTheme } from "react-native-paper";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer, DarkTheme as NavigationDarkTheme } from "@react-navigation/native";
import { NativeStackHeaderProps, createNativeStackNavigator } from "@react-navigation/native-stack";

import { AppContext } from "../App";
import { HomeScreen } from "../screens/HomeScreen";

const Header = ({ navigation, route, options, back }: NativeStackHeaderProps) => {
	const theme = usePaperTheme();
	const appContext = useContext(AppContext);

	const title =
		options.headerTitle !== undefined
			? options.headerTitle
			: options.title !== undefined
			? options.title
			: route.name;

	let canGoBack = navigation.canGoBack();

	return (
		<Appbar.Header theme={{ colors: { primary: theme.colors.surface } }}>
			<Appbar.BackAction
				disabled={!canGoBack}
				color={canGoBack ? "white" : colors.grey[100]}
				onPress={() => {
					navigation.pop();
				}}
			/>

			<Appbar.Content title={typeof title === "string" ? title : title({ children: "" })} />

			<Appbar.Action
				icon="power"
				color="white"
				onPress={() => {
					appContext.socket?.emit("logout", () => {
						AsyncStorage.removeItem("username");
						AsyncStorage.removeItem("password");

						appContext.setAppContext({
							...appContext,
							user: {
								...appContext.user,
								isAuthenticated: false,
								id: -1,
								name: "",
								username: "",
								password: "",
							},
						});
					});
				}}
			/>
		</Appbar.Header>
	);
};

const Stack = createNativeStackNavigator();

export function AppLayout({ theme }: { theme: MD3Theme }) {
	const CombinedDarkTheme = {
		...theme,
		...NavigationDarkTheme,
		colors: { ...theme.colors, ...NavigationDarkTheme.colors },
	};

	return (
		<View style={{ height: "100%" }}>
			<NavigationContainer theme={CombinedDarkTheme}>
				<Stack.Navigator initialRouteName="Home" screenOptions={{ header: Header }}>
					<Stack.Screen
						name="Home"
						component={HomeScreen}
						options={{ title: "Warehouse" }}
					/>
				</Stack.Navigator>
			</NavigationContainer>
		</View>
	);
}
