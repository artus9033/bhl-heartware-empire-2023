import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";

import { Container } from "./Container";

@Entity()
export class ProductType {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;

	@Column("float")
	typicalWeight: number;

	@Column("float")
	errorMargin: number;

	@OneToMany(() => Container, (container) => container.productType)
	containers: Container[];
}
