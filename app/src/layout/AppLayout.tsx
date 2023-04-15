import Colors from "material-colors";
import { useState } from "react";
import { ScrollView } from "react-native";

import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { HomeScreen } from "../screens/HomeScreen";

const Stack = createNativeStackNavigator();

export function AppLayout() {
	return (
		<ScrollView contentInsetAdjustmentBehavior="automatic">
			<NavigationContainer>
				<Stack.Navigator>
					<Stack.Screen
						name="home"
						component={HomeScreen}
						options={{ title: "Warehouse" }}
					/>
				</Stack.Navigator>
			</NavigationContainer>
		</ScrollView>
	);
}
