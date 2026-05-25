import { PrismaClient } from '@prisma/client';
declare global {
    var __prisma__: PrismaClient | undefined;
}
export declare const prisma: PrismaClient;
export * from '@prisma/client';
