import { Socket } from "socket.io";

export type StationSocket = Socket & {
	stationHost: string | null;
};

export type AppSocket = Socket & {
	userId: number | null;
};
