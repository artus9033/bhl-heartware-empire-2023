import { createServer } from "http";

import { Server } from "socket.io";

import { AppSocket, StationSocket } from "./Socket";
import { AppDataSource } from "./database/DataSource";
import { Container } from "./database/models/Container";
import { ProductType } from "./database/models/ProductType";
import { Station } from "./database/models/Station";
import { User } from "./database/models/User";

let stationHostToSocket: { [host: string]: StationSocket } = {};
let userIdToSocket: { [id: number]: AppSocket } = {};

async function seed() {
	let productType1 = new ProductType();
	productType1.name = "Camera";
	productType1.typicalWeight = 100;
	productType1.errorMargin = 10;

	let productType2 = new ProductType();
	productType2.name = "DC Relay";
	productType2.typicalWeight = 200;
	productType2.errorMargin = 20;

	await AppDataSource.manager.save([productType1, productType2]);

	let station = new Station();
	station.host = "UbuntuRPi";
	station.name = "BHL Station";
	station.pass = "q204gh8wgs";

	await AppDataSource.manager.save(station);

	let container1 = new Container();
	container1.name = "Cameras shelf";
	container1.productType = productType1;
	container1.serialPath = "COM7";
	container1.station = station;

	let container2 = new Container();
	container2.name = "Relays shelf";
	container2.productType = productType1;
	container2.serialPath = "COM7";
	container2.station = station;

	await AppDataSource.manager.save([container1, container2]);

	let keanu = new User();
	keanu.name = "Keanu Reeves";
	keanu.username = "keanu";
	keanu.password = "reeves";
	keanu.rfidUID = "453639431318"; // brelok
	keanu.stations = [station];

	let indiana = new User();
	indiana.name = "Indiana Jones";
	indiana.username = "indiana";
	indiana.password = "jones";
	indiana.rfidUID = "352438262451"; // karta
	indiana.stations = [station];

	await AppDataSource.manager.save([keanu, indiana]);
}

async function main() {
	await AppDataSource.initialize();

	// await seed();

	// station server

	const stationHttpServer = createServer();
	const stationIo = new Server(stationHttpServer, {});

	stationIo.on("connection", (socket: StationSocket) => {
		console.log(`[STATIONS] Station ${socket.id} connected`);

		socket.on("auth", async (host: string, pass: string) => {
			let station = await AppDataSource.manager.findOne(Station, {
				where: { host, pass },
				relations: ["containers", "containers.productType"],
			});

			if (station) {
				console.log(
					`[STATIONS] Socket ${socket.id} has just authorized as station ${station.host}`
				);

				stationHostToSocket[host] = socket;

				socket.stationHost = station.host;

				station.isConnected = true;
				await AppDataSource.manager.save(station);

				appIo.emit("refreshData");

				socket.emit(
					"initUnits",
					station.containers.map((container) => ({
						id: container.id,
						name: container.name,
						weight: container.productType.typicalWeight,
						errorMargin: container.productType.errorMargin,
						serialPath: container.serialPath,
					})),
					(success: boolean) => {
						console.log(
							`[STATIONS] Initialization of station ${
								station?.host
							} after authorization ended with result: ${
								success ? "SUCCESS" : "FAILURE"
							}`
						);
					}
				);

				return true;
			} else {
				console.log(
					`[STATIONS] Socket ${socket.id} tried to authorize as station ${socket.stationHost}, but failed (either not-existent or wrong pass code)`
				);

				return false;
			}
		});

		socket.on("disconnect", async (reason) => {
			if (socket.stationHost) {
				let station = await AppDataSource.manager.findOneBy(Station, {
					host: socket.stationHost,
				});

				if (station) {
					station.isConnected = false;

					await AppDataSource.manager.save(station);

					appIo.emit("refreshData");
				}

				delete stationHostToSocket[socket.stationHost];

				console.log(
					`[STATIONS] Station ${socket.id} (station ${socket.stationHost}) disconnected:`,
					reason
				);
			} else {
				console.log(`[STATIONS] Unauthorized socket ${socket.id} has just disconnected`);
			}
		});

		socket.on("checkUserAuthorizationForStation", async (rfidUID: string, callback: any) => {
			// authorization
			if (!socket.stationHost) {
				callback(null);
				return;
			}

			let user = await AppDataSource.manager.findOne(User, {
				where: { rfidUID },
				relations: ["stations"],
			});

			if (!user) {
				console.log(
					`[STATIONS] Socket ${socket.stationHost} asked whether user with RFID UID ${rfidUID} is authorized for access, but they are NOT present in the database at all`
				);

				callback(false);

				return;
			}

			let hitStation = user.stations.find(({ host }) => host === socket.stationHost);

			if (!hitStation) {
				console.log(
					`[STATIONS] Socket ${socket.stationHost} asked whether user with RFID UID ${rfidUID} is authorized for access, and they are NOT`
				);

				callback(false);

				return;
			}

			console.log(
				`[STATIONS] Socket ${socket.stationHost} asked whether user with RFID UID ${rfidUID} is authorized for access, and they ARE (SUCCESSFUL AUTHORIZATION)`
			);

			callback(true);
		});
	});

	stationHttpServer.listen(3000, "0.0.0.0");

	// app server

	const appHttpServer = createServer();
	const appIo = new Server(appHttpServer, {});

	appIo.on("connection", (socket: AppSocket) => {
		console.log(`Socket ${socket.id} connected`);

		socket.on("auth", async (username: string, password: string, callback: any) => {
			let user = await AppDataSource.manager.findOneBy(User, {
				username,
				password,
			});

			if (user) {
				console.log(
					`[APP] Socket ${socket.id} has just authorized as user ${user.id} (${username})`
				);

				userIdToSocket[user.id] = socket;

				socket.userId = user.id;

				callback({ success: true, id: user.id, name: user.name });
			} else {
				console.log(
					`[APP] Socket ${socket.id} tried to authorize as user ${username}, but failed (either not-existent or wrong password)`
				);

				callback({ success: false });
			}
		});

		socket.on("logout", async (callback: any) => {
			if (socket.userId) {
				delete userIdToSocket[socket.userId];

				socket.userId = null;

				console.log(`[APP] Socket ${socket.id} (user ${socket.userId}) logged out`);

				callback(true);
			} else {
				console.log(`[APP] Unauthorized socket ${socket.id} tried to log out`);

				callback(false);
			}
		});

		socket.on("disconnect", async (reason) => {
			if (socket.userId) {
				delete userIdToSocket[socket.userId];

				socket.userId = null;

				console.log(
					`[APP] Socket ${socket.id} (user ${socket.userId}) disconnected:`,
					reason
				);
			} else {
				console.log(`[APP] Unauthorized socket ${socket.id} has just disconnected`);
			}
		});

		// user API handlers

		socket.on("listStations", async (callback) => {
			// authorization
			if (!socket.userId) return null;

			let user = await AppDataSource.manager.findOne(User, {
				where: {
					id: socket.userId,
				},
				relations: ["stations", "stations.containers"],
			});
			if (!user) {
				callback(null);

				return;
			}

			let stations = user.stations.map((station) => ({
				name: station.name,
				host: station.host,
				isConnected: station.isConnected,
				containersCount: station.containers.length,
			}));

			console.log(
				`[APP] User ${socket.userId} (${user.name}) listed ${stations.length} stations`
			);

			callback(stations);
		});

		socket.on("listContainersInStation", async (host: string, callback: any) => {
			// authorization
			if (!socket.userId) return null;

			let user = await AppDataSource.manager.findOne(User, {
				where: {
					id: socket.userId,
				},
				relations: ["stations", "stations.containers", "stations.containers.productType"],
			});
			if (!user) {
				callback(null);

				return;
			}

			let matchingAllowedStation = user.stations.find(
				({ host: predHost }) => predHost === host
			);

			// check if this user can access this station
			if (!matchingAllowedStation) {
				console.warn(
					`User ${user.id} (${user.name}) tried to access station ${host}, which they don't have access to`
				);

				callback(null);

				return;
			}

			// authorization is valid here
			// @ts-ignore next line
			delete matchingAllowedStation.pass;

			console.log(
				`[APP] User ${socket.userId} (${user.name}) listed ${matchingAllowedStation.containers.length} containers' details for station ${matchingAllowedStation.host}`
			);

			callback(matchingAllowedStation);
		});

		socket.on("calibrateContainer", async (containerId: number, callback: any) => {
			// authorization
			if (!socket.userId) return null;

			let user = await AppDataSource.manager.findOne(User, {
				where: {
					id: socket.userId,
				},
				relations: ["stations", "stations.containers", "stations.containers.productType"],
			});
			if (!user) {
				callback(null);

				return;
			}

			let hitContainer: Container | null = null,
				hitParentStation: Station | null = null;
			for (let station of user.stations) {
				let maybeHitContainer = station.containers.find(({ id }) => id === containerId);

				if (maybeHitContainer) {
					hitParentStation = station;
					hitContainer = maybeHitContainer;

					break;
				}
			}

			// check if this user can access this container (i.e., it belongs to any of their containers)
			if (!hitContainer || !hitParentStation) {
				console.warn(
					`User ${user.id} (${user.name}) tried to access container ${containerId}, which they don't have access to`
				);

				callback(null);

				return;
			}

			let stationSocket = stationHostToSocket[hitParentStation.host];

			if (!stationSocket) {
				console.warn(
					`User ${user.id} (${user.name}) tried to access container ${containerId}, which they have access to, but the socket to this station is missing from the map on the server's side - it must be offline`
				);

				callback("OFFLINE");

				return;
			}

			console.log(
				`User ${user.id} (${user.name}) started calibration of container ${containerId} in station ${hitParentStation.host} `
			);

			stationSocket.emit("calibrateContainer", hitContainer.id, async (result: boolean) => {
				console.log(
					`User ${user?.id} (${
						user?.name
					}) completed calibration of container ${containerId} in station ${
						hitParentStation?.host
					} with result: ${result ? "SUCCES" : "FAILURE"}`
				);

				hitContainer!.calibrationTimestamp = new Date();

				await AppDataSource.manager.save(hitContainer!);

				appIo.emit("refreshData");

				callback(result);
			});
		});

		socket.on(
			"put_in",
			async (
				host: string,
				selectedQuantitiesMap: {
					[containerId: number]: number;
				},
				callback: any
			) => {
				// authorization
				if (!socket.userId) return null;

				let user = await AppDataSource.manager.findOne(User, {
					where: {
						id: socket.userId,
					},
					relations: [
						"stations",
						"stations.containers",
						"stations.containers.productType",
					],
				});
				if (!user) {
					callback(null);

					return;
				}

				let hitStation = user.stations.find(({ host: predHost }) => predHost === host);

				// check if this user can access this station
				if (!hitStation) {
					console.warn(
						`User ${user.id} (${user.name}) tried to access station ${host}, which they don't have access to`
					);

					callback(null);

					return;
				}

				let stationSocket = stationHostToSocket[hitStation.host];

				if (!stationSocket) {
					console.warn(
						`[APP] User ${user.id} (${user.name}) tried to access station ${host}, which they have access to, but the socket to this station is missing from the map on the server's side - it must be offline`
					);

					callback(false);

					return;
				}

				console.log(
					`[APP] User ${user.id} (${user.name}) started unlocking the station ${hitStation.host}`
				);

				let progressListener = async (
					currentContainerId: number | null | "UNLOCKED",
					currentRealContainerState: number
				) => {
					if (currentContainerId === "UNLOCKED") {
						// finished unlocking

						console.log(
							`[APP] User ${user!.id} (${
								user!.name
							}) finished unlocking the station ${
								hitStation!.host
							}; now, the instructions for the store procedure are:`,
							selectedQuantitiesMap
						);
					} else if (currentContainerId === null) {
						// finished everything

						console.log(
							`[APP] User ${user!.id} (${
								user!.name
							}) finished the storing procedure into the station ${hitStation!.host}`
						);
					} else {
						// in progress

						console.log(
							`[APP] User ${user!.id} (${
								user!.name
							}) made changes to the state while storing into the station ${
								hitStation!.host
							}:`,
							currentContainerId,
							currentRealContainerState
						);

						let container = hitStation!.containers.find(
							({ id }) => id === currentContainerId
						)!;

						container.itemsCount = currentRealContainerState;

						await AppDataSource.manager.save(container);

						appIo.emit("refreshData");
					}

					socket.emit("put_in_progress", currentContainerId, currentRealContainerState);
				};

				stationSocket.on("put_in_progress", progressListener);

				stationSocket.emit("put_in", selectedQuantitiesMap, (result: boolean) => {
					console.log(
						`[APP] User ${user!.id} (${
							user!.name
						}) completed the store procedure into station ${hitStation!.host}`
					);

					stationSocket.off("put_in_progress", progressListener);

					callback(result);
				});
			}
		);

		socket.on(
			"take_out",
			async (
				host: string,
				selectedQuantitiesMap: {
					[containerId: number]: number;
				},
				callback: any
			) => {
				// authorization
				if (!socket.userId) return null;

				let user = await AppDataSource.manager.findOne(User, {
					where: {
						id: socket.userId,
					},
					relations: [
						"stations",
						"stations.containers",
						"stations.containers.productType",
					],
				});
				if (!user) {
					callback(null);

					return;
				}

				let hitStation = user.stations.find(({ host: predHost }) => predHost === host);

				// check if this user can access this station
				if (!hitStation) {
					console.warn(
						`User ${user.id} (${user.name}) tried to access station ${host}, which they don't have access to`
					);

					callback(null);

					return;
				}

				let stationSocket = stationHostToSocket[hitStation.host];

				if (!stationSocket) {
					console.warn(
						`[APP] User ${user.id} (${user.name}) tried to access station ${host}, which they have access to, but the socket to this station is missing from the map on the server's side - it must be offline`
					);

					callback(false);

					return;
				}

				console.log(
					`[APP] User ${user.id} (${user.name}) started unlocking the station ${hitStation.host}`
				);

				let progressListener = async (
					currentContainerId: number | null | "UNLOCKED",
					currentRealContainerState: number
				) => {
					if (currentContainerId === "UNLOCKED") {
						// finished unlocking

						console.log(
							`[APP] User ${user!.id} (${
								user!.name
							}) finished unlocking the station ${
								hitStation!.host
							}; now, the instructions for the pick procedure are:`,
							selectedQuantitiesMap
						);
					} else if (currentContainerId === null) {
						// finished everything

						console.log(
							`[APP] User ${user!.id} (${
								user!.name
							}) finished the picking procedure from the station ${hitStation!.host}`
						);
					} else {
						// in progress

						console.log(
							`[APP] User ${user!.id} (${
								user!.name
							}) made changes to the state while picking from the station ${
								hitStation!.host
							}:`,
							currentContainerId,
							currentRealContainerState
						);

						let container = hitStation!.containers.find(
							({ id }) => id === currentContainerId
						)!;

						container.itemsCount = currentRealContainerState;

						await AppDataSource.manager.save(container);

						appIo.emit("refreshData");
					}

					socket.emit("take_out_progress", currentContainerId, currentRealContainerState);
				};

				stationSocket.on("take_out_progress", progressListener);

				stationSocket.emit("take_out", selectedQuantitiesMap, (result: boolean) => {
					console.log(
						`[APP] User ${user!.id} (${
							user!.name
						}) completed the pick procedure from station ${hitStation!.host}`
					);

					stationSocket.off("take_out_progress", progressListener);

					callback(result);
				});
			}
		);
	});

	appHttpServer.listen(4000, "0.0.0.0");
}

main().catch((error) => console.log("Server main error: ", error));
