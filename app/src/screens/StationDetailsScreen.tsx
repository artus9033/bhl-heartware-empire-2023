import _ from "lodash";
import colors from "material-colors";
import moment from "moment";
import { useContext, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Surface, Text, TextInput } from "react-native-paper";
import Snackbar from "react-native-snackbar";

import { useNavigation, useRoute } from "@react-navigation/native";

import { AppContext } from "../App";
import { pluralizeWord } from "../common/utils";
import { Section } from "../components/Section";
import { StationDetailsDTO } from "../types/StationDetailsDTO";

type Data = StationDetailsDTO | null; // shorthand

enum Mode {
	PICK = "pick",
	STORE = "store",
	NONE = "none",
}

export function StationDetailsScreen() {
	const appContext = useContext(AppContext);
	const navigation = useNavigation();
	const { params } = useRoute();

	const [isLoadingData, setIsLoadingData] = useState(false);
	const [data, setData] = useState<Data>(null);
	const [isCalibratingMap, setIsCalibratingMap] = useState<{ [containerId: string]: boolean }>(
		{}
	);
	const [mode, setMode] = useState<Mode>(Mode.NONE);
	const [selectedQuantitiesMap, setSelectedQuantitiesMap] = useState<{
		[productTypeId: number]: number;
	}>({});

	const loadData = () => {
		if (!appContext.socket || isLoadingData) return;

		setIsLoadingData(true);

		appContext.socket.emit(
			"listContainersInStation",
			(params as any)?.host,
			(station: Data) => {
				setIsLoadingData(false);

				if (station) {
					setData(station);
				} else {
					Snackbar.show({
						text: "Error fetching data",
						backgroundColor: colors.red[400],
						duration: Snackbar.LENGTH_SHORT,
					});
				}
			}
		);
	};

	// on mount effect
	useEffect(() => {
		loadData();
	}, []);

	let totalSelectedSum = _.sum(Object.values(selectedQuantitiesMap));

	return (
		<Surface style={{ height: "100%" }}>
			<ScrollView
				refreshControl={<RefreshControl refreshing={isLoadingData} onRefresh={loadData} />}
			>
				<Section
					style={{ marginBottom: 30 }}
					title={data ? `Station ${data?.name}` : "Loading..."}
				>
					<Text>You can find the shelves mounted inside this station below</Text>
				</Section>

				<View
					style={{
						flexDirection: "row",
						justifyContent: "space-evenly",
						marginBottom: 20,
					}}
				>
					<Button
						mode="contained-tonal"
						icon="arrow-up-bold-box-outline"
						onPress={() => {
							setMode(Mode.PICK);
						}}
						disabled={mode === Mode.STORE}
					>
						Pick items
					</Button>

					<Button
						mode="contained-tonal"
						icon="arrow-down-bold-box-outline"
						onPress={() => {
							setMode(Mode.STORE);
						}}
						disabled={mode === Mode.PICK}
					>
						Store items
					</Button>
				</View>

				{mode !== Mode.NONE && (
					<View
						style={{
							flexDirection: "row",
							justifyContent: "space-evenly",
							marginBottom: 20,
						}}
					>
						<Button
							mode="contained"
							icon="close"
							onPress={() => {
								setMode(Mode.NONE);
								setSelectedQuantitiesMap({});
							}}
						>
							Cancel
						</Button>

						<Button
							mode="contained"
							icon="close"
							onPress={() => {
								setMode(Mode.NONE);
							}}
							disabled={totalSelectedSum === 0}
						>
							Accept - {mode} ({pluralizeWord(totalSelectedSum, "item")})
						</Button>
					</View>
				)}

				{isLoadingData ? (
					<ActivityIndicator size="large" />
				) : (
					data?.containers.map((container) => {
						const selectedInThisContainer =
							selectedQuantitiesMap[container.productType.id] ?? 0;

						return (
							<Surface
								elevation={2}
								key={container.id}
								style={{ margin: 8, borderRadius: 30, overflow: "hidden" }}
							>
								<View style={{ flexDirection: "row" }}>
									<View style={styles.sectionContainer}>
										<Text style={styles.sectionTitle}>{container.name} </Text>
										<Text
											style={[
												styles.sectionSubtitle,
												{
													color: container.calibrationTimestamp
														? undefined
														: colors.red[400],
												},
											]}
										>
											{container.calibrationTimestamp
												? moment(container.calibrationTimestamp).format(
														"MM-DD-YYYY HH:mm"
												  )
												: "Not calibrated yet"}
										</Text>

										<Text style={styles.sectionSubtitle}>
											{`Stored product: ${container.productType.name}`}
										</Text>

										<Text style={styles.sectionSubtitle}>
											{pluralizeWord(container.itemsCount, "item")} inside
										</Text>
									</View>

									<View
										style={{
											margin: 20,
											alignContent: "flex-end",
											alignItems: "flex-end",
											justifyContent: "flex-start",
											flex: 1,
										}}
									>
										<TextInput
											mode="outlined"
											style={{
												margin: 0,
												width: "100%",
												fontSize: 24,
												fontWeight:
													selectedInThisContainer > 0
														? "bold"
														: undefined,
												textAlign: "center",
											}}
										>
											{selectedInThisContainer}
										</TextInput>
									</View>
								</View>

								<View
									style={{
										padding: 15,
									}}
								>
									<Button
										mode="outlined"
										onPress={() => {
											if (!appContext.socket) return;

											setIsCalibratingMap({
												...isCalibratingMap,
												[container.id]: true,
											});

											appContext.socket.emit(
												"calibrateContainer",
												container.id,
												(success: boolean | null | "OFFLINE") => {
													setIsCalibratingMap({
														...isCalibratingMap,
														[container.id]: false,
													});

													if (success === true) {
														Snackbar.show({
															text: "Calibration successful",
															backgroundColor: colors.green[400],
														});

														loadData();
													} else {
														if (success === "OFFLINE") {
															Snackbar.show({
																text: "This station is currently offline",
																backgroundColor: colors.red[300],
															});
														} else {
															Snackbar.show({
																text: "An error occured",
																backgroundColor: colors.red[400],
															});
														}
													}
												}
											);
										}}
										loading={!!isCalibratingMap[container.id]}
										disabled={!!isCalibratingMap[container.id]}
									>
										{container.calibrationTimestamp
											? "Re-calibrate"
											: "Calibrate now"}
									</Button>
								</View>
							</Surface>
						);
					})
				)}
			</ScrollView>
		</Surface>
	);
}

const styles = StyleSheet.create({
	sectionContainer: {
		marginVertical: 10,
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
