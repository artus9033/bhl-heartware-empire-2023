import { createServer } from "http";

import { Server } from "socket.io";

import { AppSocket, StationSocket } from "./Socket";
import { AppDataSource } from "./database/DataSource";
import { Station } from "./database/models/Station";
import { User } from "./database/models/User";

let stationHostToSocket: { [host: string]: StationSocket } = {};
let userIdToSocket: { [id: number]: AppSocket } = {};

async function main() {
	await AppDataSource.initialize();

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
		console.log(`User ${socket.id} connected`);

		socket.on("auth", async (username: string, password: string) => {
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

				return true;
			} else {
				console.log(
					`Socket ${socket.id} tried to authorize as user ${username}, but failed (either not-existent or wrong pass code)`
				);

				return false;
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
