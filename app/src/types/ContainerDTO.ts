import { ProductTypeDTO } from "./ProductTypeDTO";

export type ContainerDTO = {
	id: number;
	name: string;
	serialPath: string;
	calibrationTimestamp: Date | null;
	productType: ProductTypeDTO;
	itemsCount: number;
	stationHost: string;
};
