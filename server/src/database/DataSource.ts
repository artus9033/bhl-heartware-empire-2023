import "reflect-metadata";

import { DataSource } from "typeorm";

import { Container } from "./models/Container";
import { ProductType } from "./models/ProductType";
import { Station } from "./models/Station";
import { User } from "./models/User";

export const AppDataSource = new DataSource({
	type: "postgres",
	host: "localhost",
	port: 5432,
	username: "postgres",
	password: "postgres",
	database: "bhl23",
	synchronize: true,
	logging: false,
	entities: [Station, User, ProductType, Container],
	subscribers: [],
	migrations: [],
});
