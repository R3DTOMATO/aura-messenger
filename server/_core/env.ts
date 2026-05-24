export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  // ownerOpenId: email of the user who should be auto-promoted to admin on register
  ownerOpenId: process.env.OWNER_EMAIL ?? "",
  isProduction: process.env.NODE_ENV === "production",
};
