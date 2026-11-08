import mysql from 'mysql2/promise'
import 'dotenv/config'
export const pool = mysql.createPool({ host: process.env.DB_HOST, port: +(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'pasabuy', decimalNumbers: true, dateStrings: true, waitForConnections: true, connectionLimit: 10 })
export const q = async (sql, params = []) => (await pool.execute(sql, params))[0]
export const one = async (sql, params = []) => (await q(sql, params))[0] || null
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status } }
export const fail = (status, message) => { throw new HttpError(status, message) }
export const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next) // async error wrapper
