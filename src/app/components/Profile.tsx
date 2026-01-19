import React from 'react';
import { User as UserIcon, Mail, Shield, Calendar, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import type { User } from '../../utils/api';

interface ProfileProps {
  user: User;
  locationPermissionEnabled?: boolean;
  onLocationPermissionToggle?: (enabled: boolean) => void;
  favoritesCount?: number;
  wantToGoCount?: number;
}

export function Profile({ 
  user, 
  locationPermissionEnabled, 
  onLocationPermissionToggle,
  favoritesCount = 0,
  wantToGoCount = 0,
}: ProfileProps) {
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
              <div className="text-2xl font-light mb-1">{favoritesCount}</div>
              <p className="text-xs text-muted-foreground">Favorites</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-light mb-1">{wantToGoCount}</div>
              <p className="text-xs text-muted-foreground">Want to Go</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Location Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3 flex-1">
              <MapPin className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700">Auto-detect Location</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Automatically show your location on the map when you open the app
                </p>
              </div>
            </div>
            
            {/* Toggle Switch */}
            <button
              onClick={() => {
                if (onLocationPermissionToggle) {
                  onLocationPermissionToggle(!locationPermissionEnabled);
                }
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                locationPermissionEnabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
              role="switch"
              aria-checked={locationPermissionEnabled}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  locationPermissionEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}