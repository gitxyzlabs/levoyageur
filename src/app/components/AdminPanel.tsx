import { useState, useEffect } from 'react';
import { Shield, Users, Mail, Crown, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { api, type User } from '../../utils/api';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { createClient } from '@supabase/supabase-js';

interface AdminPanelProps {
  currentUser: User;
}

export function AdminPanel({ currentUser }: AdminPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { users: allUsers } = await api.getAllUsers();
      setUsers(allUsers);
    } catch (error: any) {
      console.error('Failed to load users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteToEditor = async (userId: string, userName: string) => {
    try {
      await api.updateUserRoleByAdmin(userId, 'editor');
      toast.success(`${userName} is now an editor!`);
      await loadUsers();
    } catch (error: any) {
      console.error('Failed to promote user:', error);
      toast.error('Failed to promote user');
    }
  };

  const handleDemoteToUser = async (userId: string, userName: string) => {
    try {
      await api.updateUserRoleByAdmin(userId, 'user');
      toast.success(`${userName} is now a regular user`);
      await loadUsers();
    } catch (error: any) {
      console.error('Failed to demote user:', error);
      toast.error('Failed to demote user');
    }
  };
  
  const handleMichelinBackfill = async () => {
    if (!confirm('This will backfill Michelin data to all existing locations. Continue?')) {
      return;
    }
    
    setMigrating(true);
    toast.info('Starting Michelin data backfill...');
    
    try {
      const supabase = createClient(
        `https://${projectId}.supabase.co`,
        publicAnonKey
      );
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Not authenticated');
        return;
      }
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-48182530/michelin/backfill-locations`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to run backfill');
      }
      
      const result = await response.json();
      toast.success(`Backfill complete! Updated: ${result.updated}, Created: ${result.created}, Errors: ${result.errors}`);
      console.log('Michelin backfill result:', result);
    } catch (error: any) {
      console.error('Failed to run Michelin backfill:', error);
      toast.error('Failed to run backfill');
    } finally {
      setMigrating(false);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (id: string) => {
    const colors = [
      'bg-gradient-to-br from-blue-500 to-blue-600',
      'bg-gradient-to-br from-purple-500 to-purple-600',
      'bg-gradient-to-br from-pink-500 to-pink-600',
      'bg-gradient-to-br from-rose-500 to-rose-600',
      'bg-gradient-to-br from-amber-500 to-amber-600',
      'bg-gradient-to-br from-emerald-500 to-emerald-600',
      'bg-gradient-to-br from-teal-500 to-teal-600',
      'bg-gradient-to-br from-indigo-500 to-indigo-600',
    ];
    
    const index = id.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const editorCount = users.filter(u => u.role === 'editor').length;
  const userCount = users.filter(u => u.role === 'user').length;

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-600" />
          Admin Panel
        </CardTitle>
        <CardDescription>
          Manage user roles and permissions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-semibold text-slate-900">{userCount}</div>
            <div className="text-sm text-slate-600 mt-1">Travelers</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-semibold text-amber-600">{editorCount}</div>
            <div className="text-sm text-amber-700 mt-1">Editors</div>
          </div>
        </div>

        {/* Users List */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Users className="h-4 w-4" />
            All Users
          </h3>
          
          {loading ? (
            <div className="text-center py-8 text-slate-500">
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No users found
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-full ${getAvatarColor(user.id)} flex items-center justify-center text-white font-semibold text-sm shadow-md flex-shrink-0`}>
                      {getInitials(user.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900 truncate">
                          {user.name}
                        </p>
                        {user.id === currentUser.id && (
                          <Crown className="h-4 w-4 text-amber-500 flex-shrink-0" title="You" />
                        )}
                      </div>
                      <p className="text-sm text-slate-500 truncate">{user.email}</p>
                    </div>
                    <Badge variant={user.role === 'editor' ? 'default' : 'outline'} className="flex-shrink-0">
                      {user.role === 'editor' ? '✨ Editor' : '🌍 Traveler'}
                    </Badge>
                  </div>
                  
                  {user.id !== currentUser.id && (
                    <div className="ml-3 flex-shrink-0">
                      {user.role === 'user' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePromoteToEditor(user.id, user.name)}
                          className="text-xs"
                        >
                          Make Editor
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDemoteToUser(user.id, user.name)}
                          className="text-xs text-slate-600"
                        >
                          Remove Editor
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Michelin Backfill Button */}
        <div className="mt-6">
          <Button
            size="sm"
            variant="outline"
            onClick={handleMichelinBackfill}
            className="text-xs"
            disabled={migrating}
          >
            {migrating ? 'Backfilling...' : 'Backfill Michelin Data'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}