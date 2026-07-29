require("dotenv").config({ path: "../.env" });
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.$executeRawUnsafe(
  `SELECT setval(pg_get_serial_sequence('"User"', 'id'), (SELECT MAX(id) FROM "User"))`
)
  .then((r) => {
    console.log("Sequence fixed", r);
  })
  .catch((e) => console.error(e))
  .finally(() => p.$disconnect());