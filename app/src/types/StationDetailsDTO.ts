import { ContainerDTO } from "./ContainerDTO";

export type StationDetailsDTO = {
	host: string;
	name: string;
	isConnected: string;
	containers: ContainerDTO[];
};
