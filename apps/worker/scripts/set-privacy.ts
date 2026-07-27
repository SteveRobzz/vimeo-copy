import "dotenv/config";
import { prisma, Privacy } from "@vp/db";
const [id, privacy] = process.argv.slice(2);
await prisma.video.update({ where: { id }, data: { privacy: privacy as Privacy } });
console.log(`${id} -> ${privacy}`);
await prisma.$disconnect();
