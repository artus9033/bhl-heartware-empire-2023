import colors from "material-colors";
import Colors from "material-colors";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { SafeAreaView, StatusBar, useColorScheme } from "react-native";
import { MD3DarkTheme, MD3Theme, Provider as PaperProvider } from "react-native-paper";
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
	console.log(appContext.user.isAuthenticated);
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
				// backdrop: Colors.blueGrey[600],
				// background: Colors.blueGrey[500],
				// surface: Colors.blueGrey[500],
				// primaryContainer: Colors.blueGrey[500],
				// secondaryContainer: Colors.blueGrey[500],
				// text: colors.white,
				// onBackground: colors.white,
				// onPrimaryContainer: colors.white,
				// onSecondaryContainer: colors.white,
				// onSurface: colors.white,
			},
			dark: true,
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

		appContext.socket.on("connect", onConnect);
		appContext.socket.on("disconnect", onDisconnect);

		return () => {
			appContext.socket?.off("connect", onConnect);
			appContext.socket?.off("disconnect", onDisconnect);
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
					<AppContents theme={theme} />
				</AppContext.Provider>
			</SafeAreaView>
		</PaperProvider>
	);
}

export default App;
