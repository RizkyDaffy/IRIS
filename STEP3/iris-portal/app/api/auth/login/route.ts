import { NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import mysql from 'mysql2/promise';
import { signJwt } from '@/lib/auth';

const dbConfig = {
  uri: process.env.DATABASE_URL || 'mysql://root:@localhost:3306/iris',
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    const connection = await mysql.createConnection(dbConfig.uri);

    const [rows]: any = await connection.execute(
      'SELECT id, email, passwordHash, role, status FROM User WHERE email = ?',
      [email]
    );

    await connection.end();

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = rows[0];

    const isMatch = await compare(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await signJwt({ id: user.id, email: user.email, role: user.role, status: user.status });

    const response = NextResponse.json({ success: true, status: user.status });
    response.cookies.set('jwt', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/' });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
