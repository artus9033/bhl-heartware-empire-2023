import _ from "lodash";
import colors from "material-colors";
import moment from "moment";
import { useCallback, useContext, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Vibration, View } from "react-native";
import {
	ActivityIndicator,
	Button,
	IconButton,
	Modal,
	Portal,
	ProgressBar,
	Surface,
	Text,
	TextInput,
	useTheme,
} from "react-native-paper";
import Snackbar from "react-native-snackbar";
import Sound from "react-native-sound";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

import { useNavigation, useRoute } from "@react-navigation/native";

import { AppContext } from "../App";
import { pluralizeWord } from "../common/utils";
import { Section } from "../components/Section";
import { ContainerDTO } from "../types/ContainerDTO";
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
	const theme = useTheme();
	const { params } = useRoute();

	const [isLoadingData, setIsLoadingData] = useState(false);
	const [data, setData] = useState<Data>(null);
	const [isCalibratingMap, setIsCalibratingMap] = useState<{ [containerId: string]: boolean }>(
		{}
	);
	const [mode, setMode] = useState<Mode>(Mode.NONE);
	const [selectedQuantitiesMap, setSelectedQuantitiesMap] = useState<{
		[containerId: number]: number;
	}>({});
	const [selectedQuantitiesInputsBufferMap, setSelectedQuantitiesInputsBufferMap] = useState<{
		[containerId: number]: string;
	}>({});
	const [isChangingRealState, setIsChangingRealState] = useState(false);
	const [isUnlocking, setIsUnlocking] = useState(false);

	const [processState, setProcessState] = useState<{
		currentContainer: ContainerDTO;
		currentRealContainerState: number;
		targetContainerState: number;
	} | null>(null);

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

		const refreshListener = () => {
			loadData();
		};

		appContext.socket?.on("refreshData", refreshListener);

		return () => {
			appContext.socket?.off("refreshData", refreshListener);
		};
	}, []);

	let totalSelectedSum = _.sum(Object.values(selectedQuantitiesMap));

	const playSuccess = useCallback(() => {
		let succ = new Sound("success.wav", Sound.MAIN_BUNDLE, (error) => {
			if (error) {
				console.error(error);
			}
		});

		succ.play();
	}, []);

	const playFailure = useCallback(() => {
		let err = new Sound("failure.mp3", Sound.MAIN_BUNDLE, (error) => {
			if (error) {
				console.error(error);
			}
		});

		err.play();
	}, []);

	let progressNorm = processState
		? processState.currentRealContainerState / processState.targetContainerState
		: 0;

	return (
		<Surface style={{ height: "100%" }}>
			<Portal>
				<Modal
					visible={isChangingRealState}
					contentContainerStyle={{
						padding: 15,
						margin: 10,
						backgroundColor: theme.colors.surface,
						justifyContent: "center",
						alignContent: "center",
						alignItems: "center",
						height: "80%",
						flexDirection: "column",
					}}
				>
					{isUnlocking ? (
						<>
							<View
								style={{
									flexDirection: "row",
								}}
							>
								<ActivityIndicator size="large" style={{ marginRight: 50 }} />

								<MaterialCommunityIcons
									name="security"
									size={88}
									color={theme.colors.secondary}
								/>
							</View>

							<Text
								style={{
									fontSize: 20,
									fontWeight: "800",
									textAlign: "center",
									lineHeight: 32,
									marginTop: 30,
									marginBottom: 15,
								}}
							>
								Due to security reasons, please authorize yourself by attaching your
								badge to the terminal.
							</Text>
						</>
					) : (
						<>
							<MaterialCommunityIcons
								name="arrow-down-bold-box-outline"
								size={88}
								color={theme.colors.secondary}
							/>

							{!!processState && (
								<>
									<View style={{ width: "100%", paddingHorizontal: 10 }}>
										<ProgressBar
											animatedValue={
												progressNorm > 1 ? progressNorm - 1 : progressNorm
											}
											style={{
												width: "100%",
												height: 6,
												marginVertical: 15,
											}}
											color={
												progressNorm > 1
													? colors.red[400]
													: theme.colors.secondary
											}
										/>
									</View>

									<Text
										style={{
											fontSize: 20,
											fontWeight: "800",
											textAlign: "center",
											marginVertical: 5,
											marginBottom: 30,
										}}
									>
										Container: {processState.currentContainer.name}
									</Text>

									{progressNorm === 1 ? (
										<Text
											style={{
												fontSize: 20,
												textAlign: "center",
												marginVertical: 5,
												marginBottom: 30,
												fontWeight: "bold",
											}}
										>
											Please close the door
										</Text>
									) : (
										<>
											<Text
												style={{
													fontSize: 20,
													textAlign: "center",
													marginVertical: 5,
												}}
											>
												Currently present items:{" "}
												{processState.currentRealContainerState}
											</Text>

											<Text
												style={{
													fontSize: 20,
													textAlign: "center",
													marginVertical: 5,
													marginBottom: 30,
												}}
											>
												Target items quantity:{" "}
												{processState.targetContainerState}
											</Text>

											<Text
												style={{
													fontSize: 20,
													textAlign: "center",
													marginVertical: 5,
													marginBottom: 30,
													fontWeight: "bold",
												}}
											>
												Please {progressNorm <= 1 ? "place" : "pick"}{" "}
												{pluralizeWord(
													Math.abs(
														processState.targetContainerState -
															processState.currentRealContainerState
													),
													"more item"
												)}
											</Text>

											<Text
												style={{
													fontSize: 20,
													textAlign: "center",
													marginVertical: 5,
												}}
											>
												{progressNorm > 1
													? `Over-full by ${Math.round(
															(progressNorm - 1) * 100
													  )}%`
													: `Filled in ${Math.round(
															progressNorm * 100
													  )}%`}
											</Text>
										</>
									)}
								</>
							)}
						</>
					)}
				</Modal>
			</Portal>

			<ScrollView
				refreshControl={<RefreshControl refreshing={isLoadingData} onRefresh={loadData} />}
			>
				<Section style={{ marginBottom: 30 }} title={data ? data?.name : "Loading..."}>
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
								setSelectedQuantitiesInputsBufferMap({});
							}}
						>
							Cancel
						</Button>

						<Button
							mode="contained"
							icon="close"
							onPress={() => {
								if (!appContext.socket || !data) return;

								let targetSelectedQuantitiesMap = { ...selectedQuantitiesMap }; // since these are just offsets, we need to add the counts that are already inside

								for (let key of Object.keys(targetSelectedQuantitiesMap)) {
									let keyBackAsInt = Number(key); // Object.keys() converts to string...

									if (mode === Mode.STORE) {
										targetSelectedQuantitiesMap[keyBackAsInt] +=
											data.containers.find(
												({ id }) => id === keyBackAsInt
											)!.itemsCount;
									} else {
										// PICK
										targetSelectedQuantitiesMap[keyBackAsInt] =
											data.containers.find(({ id }) => id === keyBackAsInt)!
												.itemsCount -
											targetSelectedQuantitiesMap[keyBackAsInt];
									}
								}

								console.log("Target quantities map:", targetSelectedQuantitiesMap);

								switch (mode) {
									case Mode.STORE:
										{
											setIsChangingRealState(true);

											let currentDBContainerState =
												data.containers[0].itemsCount;

											setProcessState({
												currentContainer: data.containers[0],
												currentRealContainerState:
													data.containers[0].itemsCount,
												targetContainerState:
													targetSelectedQuantitiesMap[
														data.containers[0].id
													],
											});

											let previousValue: number | null = null,
												previousContainerId: number | null = null;

											let progressListener = (
												currentContainerId: number | null | "UNLOCKED",
												currentRealContainerState: number
											) => {
												if (currentContainerId === "UNLOCKED") {
													// unlocking finished

													setIsUnlocking(false);

													console.log("Unlocked the container");

													Snackbar.show({
														text: "The shelf is now unlocked",
														backgroundColor: colors.green[400],
													});
												} else if (currentContainerId === null) {
													// finished everything

													console.log("Finished storing");

													playSuccess();

													Vibration.vibrate([700, 700, 1500]);
												} else {
													// in progress

													console.log(
														"Storing progress",
														currentContainerId,
														currentRealContainerState
													);

													if (
														previousContainerId !==
															currentContainerId &&
														previousContainerId !== null
													) {
														// finished a single container
														playSuccess();

														Vibration.vibrate(1000);
													}

													if (
														previousValue === null ||
														previousContainerId !== currentContainerId
													) {
														// started the first container
														previousValue = currentDBContainerState;
														previousContainerId = currentContainerId;
													}

													let itemCountDelta =
														currentRealContainerState - previousValue;

													let currentContainer = data.containers.find(
														({ id }) => id === currentContainerId
													)!;

													setProcessState({
														currentContainer,
														currentRealContainerState,
														targetContainerState:
															targetSelectedQuantitiesMap[
																currentContainer.id
															],
													});

													if (itemCountDelta < 0) {
														// one less, while we want one more!
														Vibration.vibrate(1000);

														if (
															currentRealContainerState <=
															targetSelectedQuantitiesMap[
																currentContainer.id
															]
														) {
															Snackbar.show({
																text: "Please store items instead of picking them",
																backgroundColor: colors.red[400],
															});
														}
													} else {
														// good, we are making progress in the right direction
														Vibration.vibrate([500, 500]);

														Snackbar.show({
															text: "Item inserted",
														});
													}

													previousValue = currentRealContainerState; // store for next iteration
												}
											};

											appContext.socket.on(
												"put_in_progress",
												progressListener
											);

											setIsUnlocking(true);

											appContext.socket.emit(
												"put_in",
												data.host,
												targetSelectedQuantitiesMap,
												(result: boolean) => {
													console.log(
														"Storing procedure completed (ended) with result:",
														result
													);

													if (result) {
														Snackbar.show({
															text: "Procedure finished successfully",
															backgroundColor: colors.green[400],
														});
													} else {
														Snackbar.show({
															text: "Could not start procedure - the station is offline",
															backgroundColor: colors.red[400],
														});
													}

													appContext.socket!.off(
														"put_in_progress",
														progressListener
													);

													setProcessState(null);
													setIsChangingRealState(false);
												}
											);
										}

										break;

									case Mode.PICK:
										{
											setIsChangingRealState(true);

											let currentDBContainerState =
												data.containers[0].itemsCount;

											setProcessState({
												currentContainer: data.containers[0],
												currentRealContainerState:
													data.containers[0].itemsCount,
												targetContainerState:
													targetSelectedQuantitiesMap[
														data.containers[0].id
													],
											});

											let previousValue: number | null = null,
												previousContainerId: number | null = null;

											let progressListener = (
												currentContainerId: number | null | "UNLOCKED",
												currentRealContainerState: number
											) => {
												if (currentContainerId === "UNLOCKED") {
													// unlocking finished

													setIsUnlocking(false);

													console.log("Unlocked the container");

													Snackbar.show({
														text: "The shelf is now unlocked",
														backgroundColor: colors.green[400],
													});
												} else if (currentContainerId === null) {
													// finished everything

													console.log("Finished picking");

													playSuccess();

													Vibration.vibrate([700, 700, 1500]);
												} else {
													// in progress

													console.log(
														"Picking progress",
														currentContainerId,
														currentRealContainerState
													);

													if (
														previousContainerId !==
															currentContainerId &&
														previousContainerId !== null
													) {
														// finished a single container
														playSuccess();

														Vibration.vibrate(1000);
													}

													if (
														previousValue === null ||
														previousContainerId !== currentContainerId
													) {
														// started the first container
														previousValue = currentDBContainerState;
														previousContainerId = currentContainerId;
													}

													let itemCountDelta =
														currentRealContainerState - previousValue;

													let currentContainer = data.containers.find(
														({ id }) => id === currentContainerId
													)!;

													setProcessState({
														currentContainer,
														currentRealContainerState,
														targetContainerState:
															targetSelectedQuantitiesMap[
																currentContainer.id
															],
													});

													if (itemCountDelta > 0) {
														// one more, while we want one less!
														Vibration.vibrate(1000);

														if (
															currentRealContainerState >=
															targetSelectedQuantitiesMap[
																currentContainer.id
															]
														) {
															Snackbar.show({
																text: "Please pick items instead of storing them",
																backgroundColor: colors.red[400],
															});
														}
													} else {
														// good, we are making progress in the right direction
														Vibration.vibrate([500, 500]);

														Snackbar.show({
															text: "Item taken",
														});
													}

													previousValue = currentRealContainerState; // store for next iteration
												}
											};

											appContext.socket.on(
												"take_out_progress",
												progressListener
											);

											setIsUnlocking(true);

											appContext.socket.emit(
												"take_out",
												data.host,
												targetSelectedQuantitiesMap,
												(result: boolean) => {
													console.log(
														"Picking procedure completed (ended) with result:",
														result
													);

													if (result) {
														Snackbar.show({
															text: "Procedure finished successfully",
															backgroundColor: colors.green[400],
														});
													} else {
														Snackbar.show({
															text: "Could not start procedure - the station is offline",
															backgroundColor: colors.red[400],
														});
													}

													appContext.socket!.off(
														"take_out_progress",
														progressListener
													);

													setProcessState(null);
													setIsChangingRealState(false);
												}
											);
										}

										break;
								}

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
					<>
						{data?.containers.map((container) => {
							const selectedInThisContainer =
									selectedQuantitiesMap[container.id] ?? 0,
								currTextBuffValue = selectedQuantitiesInputsBufferMap[container.id],
								currNumVal = selectedQuantitiesMap[container.id] ?? 0;

							return (
								<Surface
									elevation={2}
									key={container.id}
									style={{ margin: 8, borderRadius: 30, overflow: "hidden" }}
								>
									<View style={{ flexDirection: "row" }}>
										<View
											style={[styles.sectionContainer, { maxWidth: "70%" }]}
										>
											<Text style={styles.sectionTitle}>
												{container.name}{" "}
											</Text>
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

										{mode !== Mode.NONE && (
											<View
												style={{
													margin: 20,
													alignContent: "flex-end",
													alignItems: "flex-end",
													justifyContent: "flex-start",
													flexDirection: "column",
													flex: 1,
												}}
											>
												<View
													style={{
														alignContent: "center",
														alignItems: "center",
														justifyContent: "center",
														width: "100%",
														flex: 1,
														marginBottom: 10,
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
														keyboardType="numeric"
														onChangeText={(text) => {
															let numVal = Number(text.trim());

															if (
																!Number.isNaN(numVal) &&
																(mode === Mode.PICK
																	? numVal >= 0 &&
																	  numVal <= container.itemsCount
																	: true)
															) {
																setSelectedQuantitiesMap({
																	...selectedQuantitiesMap,
																	[container.id]: numVal,
																});
															}

															setSelectedQuantitiesInputsBufferMap({
																...selectedQuantitiesInputsBufferMap,
																[container.id]: text,
															});
														}}
														value={
															(currTextBuffValue
																? currTextBuffValue.length > 0
																	? // strip leading zeros
																	  currTextBuffValue.startsWith(
																			"0"
																	  ) &&
																	  currTextBuffValue.length > 1
																		? currTextBuffValue.slice(1)
																		: currTextBuffValue
																	: null
																: null) ?? String(0)
														}
													/>
												</View>

												<View
													style={{
														alignContent: "center",
														alignItems: "center",
														justifyContent: "center",
														flexDirection: "row",
														width: "100%",
														flex: 1,
													}}
												>
													<IconButton
														icon="minus"
														onPress={() => {
															let newNumVal = currNumVal - 1;

															setSelectedQuantitiesMap({
																...selectedQuantitiesMap,
																[container.id]: newNumVal,
															});

															setSelectedQuantitiesInputsBufferMap({
																...selectedQuantitiesInputsBufferMap,
																[container.id]: String(newNumVal),
															});
														}}
														disabled={currNumVal <= 0}
													/>

													<IconButton
														icon="plus"
														onPress={() => {
															let newNumVal = currNumVal + 1;

															setSelectedQuantitiesMap({
																...selectedQuantitiesMap,
																[container.id]: newNumVal,
															});

															setSelectedQuantitiesInputsBufferMap({
																...selectedQuantitiesInputsBufferMap,
																[container.id]: String(newNumVal),
															});
														}}
														disabled={
															mode === Mode.PICK &&
															currNumVal >= container.itemsCount
														}
													/>
												</View>
											</View>
										)}
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
																	backgroundColor:
																		colors.red[300],
																});
															} else {
																Snackbar.show({
																	text: "An error occured",
																	backgroundColor:
																		colors.red[400],
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
						})}

						{!data?.containers?.length && (
							<Text
								style={{
									textAlign: "center",
									width: "100%",
									fontWeight: "600",
									fontSize: 20,
									marginVertical: 20,
								}}
							>
								No containers mounted in this station
							</Text>
						)}
					</>
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
