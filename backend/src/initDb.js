// npm run db:init : creates tables, then seeds the first administrator (admins can never register through the public API).
import fs from 'fs'; import mysql from 'mysql2/promise'; import bcrypt from 'bcryptjs'; import crypto from 'crypto'; import 'dotenv/config'
const c = await mysql.createConnection({ host: process.env.DB_HOST, port: +(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, multipleStatements: true })
await c.query(fs.readFileSync(new URL('../sql/schema.sql', import.meta.url), 'utf8')); await c.changeUser({ database: process.env.DB_NAME || 'pasabuy' })
const [rows] = await c.execute('SELECT id FROM users WHERE role="admin" LIMIT 1')
if (!rows.length) { await c.execute('INSERT INTO users (id,name,username,email,password_hash,role,verified) VALUES (?,?,?,?,?,"admin",1)', [crypto.randomUUID(), 'Pasabuy Admin', 'admin', process.env.ADMIN_EMAIL, await bcrypt.hash(process.env.ADMIN_PASSWORD, 12)]); console.log('Admin created:', process.env.ADMIN_EMAIL) }
console.log('Database ready'); await c.end()
