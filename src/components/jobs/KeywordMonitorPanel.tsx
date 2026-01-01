import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { KeywordMonitor } from '@/types';
import { Eye, Plus, X, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface KeywordMonitorPanelProps {
  monitors: KeywordMonitor[];
  onUpdate: (monitors: KeywordMonitor[]) => void;
}

export function KeywordMonitorPanel({ monitors, onUpdate }: KeywordMonitorPanelProps) {
  const [newKeyword, setNewKeyword] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newLocation, setNewLocation] = useState('');

  const addMonitor = () => {
    if (!newKeyword && !newRole) {
      toast.error('Please add at least a keyword or role');
      return;
    }

    const newMonitor: KeywordMonitor = {
      id: Date.now().toString(),
      keywords: newKeyword ? [newKeyword] : [],
      roles: newRole ? [newRole] : [],
      locations: newLocation ? [newLocation] : [],
      enabled: true,
      autoApply: true,
      minMatchScore: 80
    };

    onUpdate([...monitors, newMonitor]);
    setNewKeyword('');
    setNewRole('');
    setNewLocation('');
    toast.success('Keyword monitor added');
  };

  const toggleMonitor = (id: string) => {
    onUpdate(monitors.map(m => 
      m.id === id ? { ...m, enabled: !m.enabled } : m
    ));
  };

  const toggleAutoApply = (id: string) => {
    onUpdate(monitors.map(m => 
      m.id === id ? { ...m, autoApply: !m.autoApply } : m
    ));
  };

  const removeMonitor = (id: string) => {
    onUpdate(monitors.filter(m => m.id !== id));
    toast.success('Monitor removed');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Eye className="h-5 w-5" />
          Keyword Monitoring
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add New Monitor */}
        <div className="grid gap-3 p-4 bg-muted rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="keyword" className="text-xs">Keywords</Label>
              <Input
                id="keyword"
                placeholder="e.g., Python, ML, AI"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="role" className="text-xs">Roles</Label>
              <Input
                id="role"
                placeholder="e.g., Senior Engineer"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="location" className="text-xs">Locations</Label>
              <Input
                id="location"
                placeholder="e.g., London, Remote"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <Button onClick={addMonitor} size="sm" className="w-fit">
            <Plus className="h-4 w-4 mr-1" />
            Add Monitor
          </Button>
        </div>

        {/* Active Monitors */}
        <div className="space-y-3">
          {monitors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No keyword monitors set up yet. Add one above to start instant auto-applying.
            </p>
          ) : (
            monitors.map((monitor) => (
              <div 
                key={monitor.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1 mb-1">
                    {monitor.keywords.map((k, i) => (
                      <Badge key={i} variant="default" className="text-xs">{k}</Badge>
                    ))}
                    {monitor.roles.map((r, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{r}</Badge>
                    ))}
                    {monitor.locations.map((l, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{l}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Min match: {monitor.minMatchScore}%</span>
                    <div className="flex items-center gap-1.5">
                      <Zap className="h-3 w-3" />
                      <span>Auto-apply: {monitor.autoApply ? 'On' : 'Off'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch 
                    checked={monitor.autoApply}
                    onCheckedChange={() => toggleAutoApply(monitor.id)}
                  />
                  <Switch 
                    checked={monitor.enabled}
                    onCheckedChange={() => toggleMonitor(monitor.id)}
                  />
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeMonitor(monitor.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
          <p className="text-xs text-success flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Jobs matching your monitors will be auto-applied within 2 minutes of posting
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
