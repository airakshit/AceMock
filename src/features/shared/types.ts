import { db } from "@/db";

export type DbClient = typeof db;

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type DbExecutor = DbClient | DbTransaction;
