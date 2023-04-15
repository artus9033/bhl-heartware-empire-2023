import colors from "material-colors";
import Colors from "material-colors";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { SafeAreaView, StatusBar, useColorScheme } from "react-native";
import { MD3DarkTheme, MD3Theme, Provider as PaperProvider, Surface } from "react-native-paper";
import Snackbar from "react-native-snackbar";
import { Socket, io } from "socket.io-client";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { AppLayout } from "./layout/AppLayout";
import { LoginLayout } from "./layout/LoginLayout";

export type AppContextType = {
	user: {
		username: string;
		password: string;
		id: number;
		name: string;
		isAuthenticated: boolean;
	};
	socket: Socket | null;
	setAppContext: (newValue: AppContextType) => void;
};

const DEFAULT_APP_CONTEXT: AppContextType = {
	user: {
		id: -1,
		name: "",
		username: "",
		password: "",
		isAuthenticated: false,
	},
	socket: null,
	setAppContext: () => {},
};

export const AppContext = React.createContext<AppContextType>(DEFAULT_APP_CONTEXT);

function AppContents({ theme }: { theme: MD3Theme }) {
	const appContext = useContext(AppContext);

	return appContext.user.isAuthenticated ? <AppLayout theme={theme} /> : <LoginLayout />;
}

function App(): JSX.Element {
	const theme = useMemo<MD3Theme>(
		() => ({
			...MD3DarkTheme,
			colors: {
				...MD3DarkTheme.colors,
				primary: Colors.teal[300],
				secondary: Colors.indigo[300],
			},
			dark: true,
			roundness: 8,
		}),
		[]
	);

	const [appContext, setAppContext] = useState<AppContextType>({
		...DEFAULT_APP_CONTEXT,
		socket: io("ws://localhost:4000", {
			reconnection: true,
			reconnectionAttempts: Infinity,
			reconnectionDelay: 1000,
		}),
	});

	useEffect(() => {
		if (!appContext.socket) return;

		let onConnect = () => {
			console.log("Connected to server");
		};

		let onDisconnect = () => {
			console.log("Disconnected from server");
		};

		let onReconnect = async () => {
			console.log("Reconnected to server");

			let [username, password] = await Promise.all([
				AsyncStorage.getItem("username"),
				AsyncStorage.getItem("password"),
			]);

			// retry auth, if remembered
			if (username && password) {
				console.log(
					"Retrying login after reconnection, since remembered credentials exist"
				);

				appContext.socket?.emit("auth", username, password, async (result: any) => {
					if (result.success) {
						Snackbar.show({
							text: "Re-login successful",
							backgroundColor: colors.green[400],
							duration: Snackbar.LENGTH_SHORT,
						});

						appContext.setAppContext({
							...appContext,
							user: {
								...appContext.user,
								name: result.name,
								id: result.id,
								username: username!,
								password: password!,
								isAuthenticated: true,
							},
						});
					} else {
						Snackbar.show({
							text: "Re-login failed - please sign in again",
							backgroundColor: colors.red[400],
							duration: Snackbar.LENGTH_LONG,
						});

						await Promise.all([
							AsyncStorage.removeItem("username"),
							AsyncStorage.removeItem("password"),
						]);

						appContext.setAppContext({
							...appContext,
							user: {
								...appContext.user,
								id: -1,
								isAuthenticated: false,
								name: "",
								password: "",
								username: "",
							},
						});
					}
				});
			} else {
				console.log(
					"Not retrying login after reconnection, since no remembered credentials exist"
				);
			}
		};

		appContext.socket.on("connect", onConnect);
		appContext.socket.on("disconnect", onDisconnect);
		appContext.socket.io.on("reconnect", onReconnect);

		return () => {
			appContext.socket?.off("connect", onConnect);
			appContext.socket?.off("disconnect", onDisconnect);
			appContext.socket?.io.off("reconnect", onReconnect);
		};
	}, [appContext.socket]);

	const isDarkMode = useColorScheme() === "dark";

	return (
		<PaperProvider theme={theme}>
			<SafeAreaView>
				<StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

				<AppContext.Provider
					value={{
						...appContext,
						setAppContext,
					}}
				>
					<Surface style={{ height: "100%" }}>
						<AppContents theme={theme} />
					</Surface>
				</AppContext.Provider>
			</SafeAreaView>
		</PaperProvider>
	);
}

export default App;
