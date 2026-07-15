'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    email: '',
    password: '',
  });
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) {
      setError('You must agree to the IRIS Policy and User Agreement');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      if (data.status === 'PENDING') {
        router.push('/queue');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        <div className="flex flex-col items-center mb-8">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-red-600 mb-2">
            <path d="M12 2L15 8L21 9L16 14L18 20L12 17L6 20L8 14L3 9L9 8L12 2Z" fill="currentColor"/>
          </svg>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">IRIS PORTAL</h1>
          <p className="text-gray-500 text-sm mt-1">Create a new account</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-900 mb-1">First Name</label>
              <input 
                type="text" 
                required
                value={formData.firstName}
                onChange={e => setFormData({...formData, firstName: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-600"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-900 mb-1">Middle Name</label>
              <input 
                type="text" 
                value={formData.middleName}
                onChange={e => setFormData({...formData, middleName: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-600"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Email</label>
            <input 
              type="email" 
              required
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-600"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Password</label>
            <input 
              type="password" 
              required
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-600"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Captcha</label>
            <div className="flex gap-3">
              <div className="flex-1 bg-gray-100 rounded-lg flex items-center justify-center font-mono font-bold text-gray-600 tracking-widest select-none">
                x9F2a
              </div>
              <input 
                type="text" 
                required
                className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-600"
                placeholder="Enter captcha"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
              <input 
                type="checkbox" 
                checked={agree}
                onChange={e => setAgree(e.target.checked)}
                className="mt-1 rounded border-gray-300 text-red-600 focus:ring-red-600" 
              />
              <span>I agree to the IRIS Policy and User Agreement</span>
            </label>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 mt-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account? <Link href="/login" className="text-red-600 font-semibold hover:underline">Sign in here</Link>
        </p>
      </div>
    </div>
  );
}
