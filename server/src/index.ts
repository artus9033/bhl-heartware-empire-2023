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
	keanu.rfidUID = "520EF51A"; // karta
	keanu.stations = [station];

	let indiana = new User();
	indiana.name = "Indiana Jones";
	indiana.username = "indiana";
	indiana.password = "jones";
	indiana.rfidUID = "699F0464"; // brelok
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
		console.log(`Station ${socket.id} connected`);

		socket.on("auth", async (host: string, pass: string) => {
			let station = await AppDataSource.manager.findOneBy(Station, {
				host,
				pass,
			});

			if (station) {
				console.log(`Socket ${socket.id} has just authorized as station ${station.host}`);

				stationHostToSocket[host] = socket;

				socket.stationHost = station.host;

				station.isConnected = true;
				await AppDataSource.manager.save(station);

				return true;
			} else {
				console.log(
					`Socket ${socket.id} tried to authorize as station ${socket.stationHost}, but failed (either not-existent or wrong pass code)`
				);

				return false;
			}
		});

		socket.on("disconnect", async (reason) => {
			if (socket.stationHost) {
				delete stationHostToSocket[socket.stationHost];

				let station = await AppDataSource.manager.findOneBy(Station, {
					host: socket.stationHost,
				});

				if (station) {
					station.isConnected = true;

					await AppDataSource.manager.save(station);
				}

				console.log(
					`Station ${socket.id} (station ${socket.stationHost}) disconnected:`,
					reason
				);
			} else {
				console.log(`Unauthorized socket ${socket.id} has just disconnected`);
			}
		});
	});

	stationHttpServer.listen(3000);

	// app server

	const appHttpServer = createServer();
	const appIo = new Server(appHttpServer, {});

	appIo.on("connection", (socket: AppSocket) => {
		console.log(`Socket ${socket.id} connected`);

		socket.on("auth", async (username: string, password: string, callback) => {
			let user = await AppDataSource.manager.findOneBy(User, {
				username,
				password,
			});

			if (user) {
				console.log(
					`Socket ${socket.id} has just authorized as user ${user.id} (${username})`
				);

				userIdToSocket[user.id] = socket;

				socket.userId = user.id;

				callback({ success: true, id: user.id, name: user.name });
			} else {
				console.log(
					`Socket ${socket.id} tried to authorize as user ${username}, but failed (either not-existent or wrong password)`
				);

				callback({ success: false });
			}
		});

		socket.on("logout", async () => {
			if (socket.userId) {
				delete userIdToSocket[socket.userId];

				socket.userId = null;

				console.log(`Socket ${socket.id} (user ${socket.userId}) logged out`);
			} else {
				console.log(`Unauthorized socket ${socket.id} tried to log out`);
			}
		});

		socket.on("disconnect", async (reason) => {
			if (socket.userId) {
				delete userIdToSocket[socket.userId];

				socket.userId = null;

				console.log(`Socket ${socket.id} (user ${socket.userId}) disconnected:`, reason);
			} else {
				console.log(`Unauthorized socket ${socket.id} has just disconnected`);
			}
		});
	});

	appHttpServer.listen(4000);
}

main().catch((error) => console.log("Server main error: ", error));
