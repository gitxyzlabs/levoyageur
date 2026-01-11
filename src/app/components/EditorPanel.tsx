import { useState } from 'react';
import { api } from '../../utils/api';
import type { Location } from '../../utils/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

interface EditorPanelProps {
  onLocationAdded: () => void;
  locations: Location[];
  onLocationDeleted: () => void;
}

export function EditorPanel({ onLocationAdded, locations, onLocationDeleted }: EditorPanelProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [description, setDescription] = useState('');
  const [lvEditorsScore, setLvEditorsScore] = useState('');
  const [lvCrowdsourceScore, setLvCrowdsourceScore] = useState('');
  const [googleRating, setGoogleRating] = useState('');
  const [michelinScore, setMichelinScore] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setName('');
    setLat('');
    setLng('');
    setDescription('');
    setLvEditorsScore('');
    setLvCrowdsourceScore('');
    setGoogleRating('');
    setMichelinScore('');
    setTags('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const location = {
        name,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        description,
        lvEditorsScore: parseFloat(lvEditorsScore) || 0,
        lvCrowdsourceScore: parseFloat(lvCrowdsourceScore) || 0,
        googleRating: parseFloat(googleRating) || 0,
        michelinScore: parseFloat(michelinScore) || 0,
        tags: tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      };

      await api.addLocation(location);
      toast.success('Location added successfully!');
      resetForm();
      setOpen(false);
      onLocationAdded();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add location');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this location?')) {
      return;
    }

    try {
      await api.deleteLocation(id);
      toast.success('Location deleted successfully!');
      onLocationDeleted();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete location');
    }
  };

  return (
    <div className="space-y-4">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button className="w-full" size="lg">
            <Plus className="mr-2 h-5 w-5" />
            Add New Location
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add New Location</SheetTitle>
            <SheetDescription>
              Add a new restaurant, hotel, or attraction to Le Voyageur.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Restaurant name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lat">Latitude *</Label>
                <Input
                  id="lat"
                  type="number"
                  step="any"
                  placeholder="32.7157"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lng">Longitude *</Label>
                <Input
                  id="lng"
                  type="number"
                  step="any"
                  placeholder="-117.1611"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lvEditorsScore">LV Editors Score (0-10)</Label>
                <Input
                  id="lvEditorsScore"
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  placeholder="8.5"
                  value={lvEditorsScore}
                  onChange={(e) => setLvEditorsScore(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lvCrowdsourceScore">LV Community Score (0-10)</Label>
                <Input
                  id="lvCrowdsourceScore"
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  placeholder="9.0"
                  value={lvCrowdsourceScore}
                  onChange={(e) => setLvCrowdsourceScore(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="googleRating">Google Rating (0-5)</Label>
                <Input
                  id="googleRating"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  placeholder="4.5"
                  value={googleRating}
                  onChange={(e) => setGoogleRating(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="michelinScore">Michelin Score (0-3)</Label>
                <Input
                  id="michelinScore"
                  type="number"
                  step="0.1"
                  min="0"
                  max="3"
                  placeholder="2"
                  value={michelinScore}
                  onChange={(e) => setMichelinScore(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                placeholder="tacos, mexican, casual"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Add tags like "tacos", "fine-dining", "hotel", etc.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Adding...' : 'Add Location'}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <Card>
        <CardHeader>
          <CardTitle>Manage Locations</CardTitle>
          <CardDescription>
            {locations.length} location{locations.length !== 1 ? 's' : ''} in the database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {locations.map((location) => (
              <div
                key={location.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{location.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {location.tags?.join(', ') || 'No tags'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(location.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}