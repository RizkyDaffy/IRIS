import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import mysql from 'mysql2/promise';
import { randomUUID } from 'crypto';
import { signJwt } from '@/lib/auth';

const dbConfig = {
  // Extracting from standard DATABASE_URL e.g., mysql://user:pass@localhost:3306/iris
  uri: process.env.DATABASE_URL || 'mysql://root:@localhost:3306/iris',
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { firstName, middleName, email, password } = body;

    const connection = await mysql.createConnection(dbConfig.uri);

    const isSuperAdmin = email === 'admin@iris.com';
    const role = isSuperAdmin ? 'SUPER_ADMIN' : 'DEVELOPER';
    const status = isSuperAdmin ? 'ACTIVE' : 'PENDING';

    const passwordHash = await hash(password, 10);
    // ponytail: native cuid logic is complex in pure SQL without Prisma, fallback to randomUUID
    const id = randomUUID(); 
    const now = new Date();

    const [result] = await connection.execute(
      `INSERT INTO User (id, email, passwordHash, firstName, middleName, role, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, email, passwordHash, firstName, middleName || null, role, status, now, now]
    );

    await connection.end();

    const token = await signJwt({ id, email, role, status });

    const response = NextResponse.json({ success: true, status });
    response.cookies.set('jwt', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/' });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
