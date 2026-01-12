import React from 'react';
import { User as UserIcon, Mail, Shield, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import type { User } from '../../utils/api';

interface ProfileProps {
  user: User;
}

export function Profile({ user }: ProfileProps) {
  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Avatar */}
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-light">
              {user.name.charAt(0).toUpperCase()}
            </div>
            
            {/* Name */}
            <div>
              <h2 className="text-2xl font-light tracking-wide">{user.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
            </div>
            
            {/* Role Badge */}
            <div className={`px-4 py-1.5 rounded-full text-xs font-medium ${
              user.role === 'editor' 
                ? 'bg-amber-100 text-amber-800' 
                : 'bg-slate-100 text-slate-700'
            }`}>
              {user.role === 'editor' ? '✨ LV Editor' : 'Voyageur'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-700">Email</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-700">Account Type</p>
              <p className="text-sm text-muted-foreground">
                {user.role === 'editor' ? 'LV Editor (can add locations)' : 'Standard User'}
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <UserIcon className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-700">User ID</p>
              <p className="text-sm text-muted-foreground font-mono">
                {user.id.slice(0, 16)}...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-light mb-1">0</div>
              <p className="text-xs text-muted-foreground">Favorites</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-light mb-1">0</div>
              <p className="text-xs text-muted-foreground">Reviews</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}