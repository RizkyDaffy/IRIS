import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  uri: process.env.DATABASE_URL || 'mysql://root:@localhost:3306/iris',
};

export async function GET(req: Request) {
  const role = req.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const connection = await mysql.createConnection(dbConfig.uri);
    const [rows] = await connection.execute('SELECT id, email, firstName, role, status, createdAt FROM User ORDER BY createdAt DESC');
    await connection.end();
    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const role = req.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, status } = await req.json();
    const connection = await mysql.createConnection(dbConfig.uri);
    await connection.execute('UPDATE User SET status = ? WHERE id = ?', [status, id]);
    await connection.end();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
