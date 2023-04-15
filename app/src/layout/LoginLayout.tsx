import colors from "material-colors";
import React, { useContext, useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { Button, IconButton, Text, TextInput, useTheme } from "react-native-paper";
import Snackbar from "react-native-snackbar";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { AppContext } from "../App";
import { Section } from "../components/Section";

export const LoginLayout = () => {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [isPasswordVisible, setIsPasswordVisible] = useState(false);
	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const appContext = useContext(AppContext);

	const togglePasswordVisibility = () => {
		setIsPasswordVisible(!isPasswordVisible);
	};

	const login = (username: string, password: string) => {
		if (!appContext.socket) return;

		setIsAuthenticating(true);

		appContext.socket.emit("auth", username, password, async (result: any) => {
			setIsAuthenticating(false);

			if (result.success) {
				appContext.setAppContext({
					...appContext,
					user: {
						...appContext.user,
						name: result.name,
						id: result.id,
						username,
						password,
						isAuthenticated: true,
					},
				});

				await Promise.all([
					AsyncStorage.setItem("username", username),
					AsyncStorage.setItem("password", password),
				]);

				Snackbar.show({
					text: "Login successful",
					backgroundColor: colors.green[400],
					duration: Snackbar.LENGTH_SHORT,
				});
			} else {
				Snackbar.show({
					text: "Invalid credentials",
					backgroundColor: colors.red[400],
					duration: Snackbar.LENGTH_SHORT,
				});
			}
		});
	};

	// on mount
	useEffect(() => {
		(async () => {
			let existingUsername = await AsyncStorage.getItem("username");
			let existingPassword = await AsyncStorage.getItem("password");

			if (existingUsername && existingPassword) {
				login(existingUsername, existingPassword);
			}
		})();
	}, []);

	return (
		<ScrollView contentContainerStyle={styles.container}>
			<View
				style={{
					flexDirection: "row",
					justifyContent: "center",
					paddingVertical: 20,
				}}
			>
				<Section style={{ marginBottom: 80, marginTop: 20 }} title="ShelfSense App">
					<Text>Log on to your account</Text>
				</Section>

				<View>
					<Image
						source={require("../assets/app_icon.png")}
						style={{
							resizeMode: "contain",
							width: "auto",
							height: 100,
							aspectRatio: 1.0,
						}}
					/>
				</View>
			</View>

			<TextInput
				label="Username"
				value={username}
				textContentType="username"
				autoCapitalize="none"
				onChangeText={setUsername}
				mode="flat"
				style={styles.input}
			/>

			<TextInput
				label="Password"
				value={password}
				textContentType="password"
				autoCapitalize="none"
				onChangeText={setPassword}
				mode="flat"
				style={styles.input}
				secureTextEntry={!isPasswordVisible}
				right={
					<TextInput.Icon
						icon={isPasswordVisible ? "eye-off" : "eye"}
						onPress={togglePasswordVisibility}
						forceTextInputFocus={false}
					/>
				}
			/>

			<Button
				loading={isAuthenticating}
				disabled={isAuthenticating}
				mode="contained"
				onPress={() => {
					login(username, password);
				}}
				style={styles.button}
				labelStyle={styles.buttonLabel}
			>
				Log In
			</Button>
		</ScrollView>
	);
};

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: 20,
		paddingVertical: 50,
	},
	input: {
		marginVertical: 8,
	},
	button: {
		marginTop: 16,
		height: 48,
		justifyContent: "center",
	},
	buttonLabel: {
		fontWeight: "bold",
	},
});

export default LoginLayout;
