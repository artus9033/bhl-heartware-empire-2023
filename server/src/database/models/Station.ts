import {
	Column,
	Entity,
	ManyToOne,
	OneToMany,
	PrimaryColumn,
	PrimaryGeneratedColumn,
} from "typeorm";

import { Container } from "./Container";

@Entity()
export class Station {
	@PrimaryColumn()
	host: string;

	@Column()
	pass: string;

	@Column()
	name: string;

	@Column()
	isConnected: boolean;

	@OneToMany(() => Container, (container) => container.station)
	containers: Container[];
}
