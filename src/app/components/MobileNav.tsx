import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  X,
  LogIn,
  LogOut,
  User,
  Heart,
  Bookmark,
  Settings,
  Menu,
} from 'lucide-react';

import { Favorites } from './Favorites';
import { WantToGo } from './WantToGo';
import { Profile } from './Profile';
import { Button } from './ui/button';

import type { User as APIUser } from '../../utils/api';
import type { Location } from '../hooks/useLocations';

type SidebarView = 'favorites' | 'wantToGo' | 'profile';

interface MobileNavProps {
  user: APIUser | null;
  sidebarView: SidebarView;
  onSidebarViewChange: (view: SidebarView) => void;
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
  userLocation: { lat: number; lng: number } | null;
  locationPermissionEnabled: boolean;
  onLocationPermissionToggle: (enabled: boolean) => void;
  favoritesCount: number;
  wantToGoCount: number;
  onMichelinSyncComplete: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onLocationSelect: (location: Location) => void;
  onCenterOnUser: () => void;
}

/**
 * Mobile-only chrome: the top bar, the slide-up drawer (favorites/want-to-go/
 * profile), and the bottom tab bar. All three share drawerOpen/sidebarView,
 * which is why they're one component rather than three.
 */
export function MobileNav({
  user,
  sidebarView,
  onSidebarViewChange,
  drawerOpen,
  onDrawerOpenChange,
  userLocation,
  locationPermissionEnabled,
  onLocationPermissionToggle,
  favoritesCount,
  wantToGoCount,
  onMichelinSyncComplete,
  onLogin,
  onLogout,
  onLocationSelect,
  onCenterOnUser,
}: MobileNavProps) {
  const openTab = (view: SidebarView) => {
    onSidebarViewChange(view);
    onDrawerOpenChange(true);
  };

  return (
    <>
      {/* Mobile Header - Only visible on mobile */}
      <div className="md:hidden absolute top-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-light tracking-wider">LE VOYAGEUR</h1>
          {!user ? (
            <Button
              onClick={onLogin}
              size="sm"
              className="gap-1.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign in
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onDrawerOpenChange(true)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Menu className="h-5 w-5 text-gray-700" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Slide-Up Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => onDrawerOpenChange(false)}
              className="md:hidden fixed inset-0 bg-black/40 z-40"
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col"
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
              </div>

              <div className="px-6 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => onDrawerOpenChange(false)}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 p-4 border-b border-slate-100">
                <button
                  onClick={() => onSidebarViewChange('favorites')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    sidebarView === 'favorites'
                      ? 'bg-slate-900 text-white shadow-lg'
                      : 'bg-slate-50 text-gray-600 hover:bg-slate-100'
                  }`}
                >
                  <Heart className="h-4 w-4" />
                  Favorites
                </button>
                <button
                  onClick={() => onSidebarViewChange('wantToGo')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    sidebarView === 'wantToGo'
                      ? 'bg-slate-900 text-white shadow-lg'
                      : 'bg-slate-50 text-gray-600 hover:bg-slate-100'
                  }`}
                >
                  <Bookmark className="h-4 w-4" />
                  Want to Go
                </button>
                <button
                  onClick={() => onSidebarViewChange('profile')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    sidebarView === 'profile'
                      ? 'bg-slate-900 text-white shadow-lg'
                      : 'bg-slate-50 text-gray-600 hover:bg-slate-100'
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  Profile
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-2">
                {sidebarView === 'favorites' && (
                  <Favorites
                    key={favoritesCount}
                    user={user!}
                    userLocation={userLocation}
                    onLocationClick={(location) => {
                      onLocationSelect(location);
                      onDrawerOpenChange(false);
                    }}
                  />
                )}

                {sidebarView === 'wantToGo' && (
                  <WantToGo
                    key={wantToGoCount}
                    user={user!}
                    userLocation={userLocation}
                    onLocationClick={(location) => {
                      onLocationSelect(location);
                      onDrawerOpenChange(false);
                    }}
                  />
                )}

                {sidebarView === 'profile' && (
                  <Profile
                    user={user!}
                    locationPermissionEnabled={locationPermissionEnabled}
                    onLocationPermissionToggle={onLocationPermissionToggle}
                    favoritesCount={favoritesCount}
                    wantToGoCount={wantToGoCount}
                    onMichelinSyncComplete={onMichelinSyncComplete}
                  />
                )}
              </div>

              <div className="p-4 border-t border-slate-200 bg-slate-50">
                <Button
                  onClick={() => {
                    onLogout();
                    onDrawerOpenChange(false);
                  }}
                  variant="outline"
                  className="w-full gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation - Only visible when logged in */}
      {user && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-t border-slate-200 shadow-lg">
          <div className="flex items-center justify-around px-2 py-3 safe-area-inset-bottom">
            <button
              onClick={() => openTab('favorites')}
              className={`relative flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                sidebarView === 'favorites' && drawerOpen ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`}
            >
              <Heart className={`h-5 w-5 ${sidebarView === 'favorites' && drawerOpen ? 'text-red-500' : 'text-gray-600'}`} />
              <span className="text-xs font-medium text-gray-700">Favorites</span>
              {favoritesCount > 0 && (
                <div className="absolute -top-1 right-2 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {favoritesCount}
                </div>
              )}
            </button>

            <button
              onClick={() => {
                onCenterOnUser();
                onDrawerOpenChange(false);
              }}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg hover:bg-slate-50 transition-all"
            >
              <MapPin className="h-5 w-5 text-blue-500" />
              <span className="text-xs font-medium text-gray-700">Map</span>
            </button>

            <button
              onClick={() => openTab('wantToGo')}
              className={`relative flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                sidebarView === 'wantToGo' && drawerOpen ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`}
            >
              <Bookmark className={`h-5 w-5 ${sidebarView === 'wantToGo' && drawerOpen ? 'text-blue-500' : 'text-gray-600'}`} />
              <span className="text-xs font-medium text-gray-700">Want to Go</span>
              {wantToGoCount > 0 && (
                <div className="absolute -top-1 left-0 min-w-[18px] h-[18px] bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {wantToGoCount}
                </div>
              )}
            </button>

            <button
              onClick={() => openTab('profile')}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                sidebarView === 'profile' && drawerOpen ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`}
            >
              <Settings className={`h-5 w-5 ${sidebarView === 'profile' && drawerOpen ? 'text-gray-900' : 'text-gray-600'}`} />
              <span className="text-xs font-medium text-gray-700">Profile</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
