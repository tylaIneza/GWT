import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as mysql from 'mysql2/promise';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: mysql.Pool;
  private readonly logger = new Logger(DatabaseService.name);

  async onModuleInit() {
    this.pool = mysql.createPool({
      host:             process.env.DB_HOST     || 'localhost',
      port:             parseInt(process.env.DB_PORT || '3306'),
      user:             process.env.DB_USER     || 'root',
      password:         process.env.DB_PASSWORD || '',
      database:         process.env.DB_NAME     || 'codearena',
      waitForConnections: true,
      connectionLimit:  20,
      timezone:         'Z',
      dateStrings:      false,
    });
    await this.pool.query('SELECT 1');
    this.logger.log('MySQL (MariaDB) connected');
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS challenge_sessions (
        id           VARCHAR(36)                             NOT NULL PRIMARY KEY,
        user_id      VARCHAR(36)                             NOT NULL,
        challenge_id VARCHAR(36)                             NOT NULL,
        status       ENUM('active','completed','timed_out')  NOT NULL DEFAULT 'active',
        started_at   DATETIME                                NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at   DATETIME                                NOT NULL,
        INDEX idx_uc (user_id, challenge_id),
        FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE,
        FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
      )
    `);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  /** Raw query — returns [rows, fields] */
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(sql, params);
    return rows as unknown as T[];
  }

  /** Returns first row or null */
  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(sql, params);
    return (rows[0] as unknown as T) || null;
  }

  /** Returns all rows */
  async queryMany<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(sql, params);
    return rows as unknown as T[];
  }

  /** Execute INSERT/UPDATE/DELETE — returns OkPacket */
  async execute(sql: string, params?: any[]): Promise<mysql.OkPacket> {
    const [result] = await this.pool.execute(sql, params);
    return result as mysql.OkPacket;
  }

  /** Atomic transaction */
  async transaction<T>(fn: (client: mysql.PoolConnection) => Promise<T>): Promise<T> {
    const conn = await this.pool.getConnection();
    await conn.beginTransaction();
    try {
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /** Query using a transaction connection */
  async txQuery<T = any>(conn: mysql.PoolConnection, sql: string, params?: any[]): Promise<T[]> {
    const [rows] = await conn.query<mysql.RowDataPacket[]>(sql, params);
    return rows as unknown as T[];
  }

  async txQueryOne<T = any>(conn: mysql.PoolConnection, sql: string, params?: any[]): Promise<T | null> {
    const [rows] = await conn.query<mysql.RowDataPacket[]>(sql, params);
    return (rows[0] as unknown as T) || null;
  }
}
