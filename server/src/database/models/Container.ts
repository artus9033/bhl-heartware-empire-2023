import {
	Column,
	Entity,
	ManyToOne,
	OneToMany,
	PrimaryColumn,
	PrimaryGeneratedColumn,
} from "typeorm";

import { ProductType } from "./ProductType";
import { Station } from "./Station";

@Entity()
export class Container {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;

	@Column("timestamp without time zone", { default: null })
	calibrationTimestamp: Date | null;

	@ManyToOne(() => ProductType, (productType) => productType.containers)
	productType: ProductType;

	@ManyToOne(() => Station, (station) => station.containers)
	station: Station;
}
