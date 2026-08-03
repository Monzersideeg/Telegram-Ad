import crypto from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error("Usage: npx tsx scripts/hash-admin-password.ts 'your-strong-password'");
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString("hex");
crypto.scrypt(password, salt, 64, (err, key) => {
  if (err) throw err;
  console.log(`scrypt$${salt}$${key.toString("hex")}`);
});
