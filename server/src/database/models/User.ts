import {
	Column,
	Entity,
	JoinTable,
	ManyToMany,
	PrimaryColumn,
	PrimaryGeneratedColumn,
} from "typeorm";

import { Station } from "./Station";

@Entity()
export class User {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;

	@Column()
	username: string;

	@Column("varchar", { select: false })
	password: string | null;

	@Column("varchar")
	rfidUID: string | null;

	@ManyToMany(() => Station)
	@JoinTable()
	stations: Station[];
}
