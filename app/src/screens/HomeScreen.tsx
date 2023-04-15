import colors from "material-colors";
import { useContext, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Surface, Text } from "react-native-paper";
import Snackbar from "react-native-snackbar";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

import { useNavigation } from "@react-navigation/native";

import { AppContext } from "../App";
import { pluralizeWord } from "../common/utils";
import { Section } from "../components/Section";
import { ListStationDTO } from "../types/ListStationDTO";

type Data = Array<ListStationDTO> | null; // shorthand

export function HomeScreen() {
	const appContext = useContext(AppContext);
	const navigation = useNavigation();

	const [isLoadingData, setIsLoadingData] = useState(false);
	const [data, setData] = useState<Data>(null);

	const loadData = () => {
		if (!appContext.socket || isLoadingData) return;

		setIsLoadingData(true);

		appContext.socket.emit("listStations", (stations: Data) => {
			setIsLoadingData(false);

			if (stations) {
				setData(stations);
			} else {
				Snackbar.show({
					text: "Error fetching data",
					backgroundColor: colors.red[400],
					duration: Snackbar.LENGTH_SHORT,
				});
			}
		});
	};

	// on mount effect
	useEffect(() => {
		loadData();
	}, []);

	return (
		<Surface style={{ height: "100%" }}>
			<ScrollView
				refreshControl={<RefreshControl refreshing={isLoadingData} onRefresh={loadData} />}
			>
				<Section style={{ marginBottom: 30 }} title="Your stations">
					<Text>This is your smart warehouse</Text>
				</Section>

				{isLoadingData ? (
					<ActivityIndicator size="large" />
				) : (
					data?.map((station) => (
						<Surface
							elevation={2}
							key={station.host}
							style={{ margin: 8, borderRadius: 30, overflow: "hidden" }}
						>
							<Pressable
								android_ripple={{
									color: "#ffffff66",
								}}
								onPress={() => {
									// if (station.isConnected) {
									// @ts-ignore next line
									navigation.navigate("Station", { host: station.host });
									// }
								}}
							>
								<View style={{ flexDirection: "row" }}>
									<View style={styles.sectionContainer}>
										<Text style={styles.sectionTitle}>{station.name} </Text>
										<Text style={styles.sectionSubtitle}>
											Host: {station.host}
										</Text>
										<Text style={styles.sectionSubtitle}>
											{pluralizeWord(station.containersCount, "container")}{" "}
											inside
										</Text>
									</View>

									<View
										style={{
											margin: 40,
											alignContent: "flex-end",
											alignItems: "flex-end",
											justifyContent: "flex-start",
											flex: 1,
										}}
									>
										<MaterialCommunityIcons
											name={`lan-${station.isConnected ? "" : "dis"}connect`}
											color={
												station.isConnected
													? colors.green[300]
													: colors.red[300]
											}
											size={38}
										/>
									</View>
								</View>
							</Pressable>
						</Surface>
					))
				)}
			</ScrollView>
		</Surface>
	);
}

const styles = StyleSheet.create({
	sectionContainer: {
		marginVertical: 32,
		paddingHorizontal: 24,
	},
	sectionTitle: {
		fontSize: 28,
		fontWeight: "600",
		marginBottom: 10,
	},
	sectionSubtitle: {
		fontSize: 18,
		fontWeight: "600",
	},
	sectionDescription: {
		marginTop: 8,
		fontSize: 18,
		fontWeight: "400",
	},
});
