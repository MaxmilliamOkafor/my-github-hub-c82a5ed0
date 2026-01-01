import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, Calendar, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface JobSearchPanelProps {
  onSearchComplete: () => void;
  isSearching: boolean;
  setIsSearching: (val: boolean) => void;
}

const LOCATIONS = [
  { value: 'all', label: 'All Locations' },
  { value: 'Remote', label: 'Remote' },
  { value: 'United States', label: 'United States' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'Ireland', label: 'Ireland' },
  { value: 'Europe', label: 'Europe' },
  { value: 'London', label: 'London, UK' },
  { value: 'Dublin', label: 'Dublin, Ireland' },
  { value: 'New York', label: 'New York, US' },
  { value: 'San Francisco', label: 'San Francisco, US' },
  { value: 'Germany', label: 'Germany' },
  { value: 'Netherlands', label: 'Netherlands' },
];

const DATE_FILTERS = [
  { value: 'all', label: 'Any Time' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '3d', label: 'Last 3 Days' },
  { value: 'week', label: 'Last Week' },
  { value: 'month', label: 'Last Month' },
];

export function JobSearchPanel({ onSearchComplete, isSearching, setIsSearching }: JobSearchPanelProps) {
  const { user } = useAuth();
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('Remote');
  const [dateFilter, setDateFilter] = useState('week');

  const parseKeywords = (input: string): string[] => {
    return input
      .replace(/["""]/g, '')
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);
  };

  const keywordCount = parseKeywords(keywords).length;

  const handleSearch = async () => {
    if (!user) {
      toast.error('Please log in to search');
      return;
    }

    const parsedKeywords = parseKeywords(keywords);
    if (parsedKeywords.length === 0) {
      toast.error('Please enter at least one keyword');
      return;
    }

    setIsSearching(true);
    
    try {
      toast.info(`Searching for ${parsedKeywords.length} keywords...`, { id: 'job-search' });
      
      const { data, error } = await supabase.functions.invoke('search-jobs-google', {
        body: {
          keywords: parsedKeywords.join(', '),
          location: location === 'all' ? '' : location,
          dateFilter,
          user_id: user.id,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Found ${data.totalFound} jobs!`, { id: 'job-search' });
        onSearchComplete();
      } else {
        throw new Error(data?.error || 'Search failed');
      }
    } catch (error) {
      console.error('Job search error:', error);
      toast.error('Search failed. Please try again.', { id: 'job-search' });
    } finally {
      setIsSearching(false);
    }
  };

  const clearKeywords = () => setKeywords('');

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardContent className="p-6 space-y-4">
        {/* Keywords textarea */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Keywords</label>
            <div className="flex items-center gap-2">
              {keywordCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {keywordCount} keyword{keywordCount !== 1 ? 's' : ''}
                </Badge>
              )}
              {keywords && (
                <Button variant="ghost" size="sm" onClick={clearKeywords} className="h-7 text-xs">
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
          <Textarea
            placeholder="Enter keywords separated by commas, e.g.: Data Scientist, Machine Learning, Python, AWS, Product Manager..."
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            className="min-h-[100px] resize-none bg-background"
          />
        </div>

        {/* Filters row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger className="pl-10 h-11 bg-background">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                {LOCATIONS.map(loc => (
                  <SelectItem key={loc.value} value={loc.value}>{loc.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="pl-10 h-11 bg-background">
                <SelectValue placeholder="Posted" />
              </SelectTrigger>
              <SelectContent>
                {DATE_FILTERS.map(df => (
                  <SelectItem key={df.value} value={df.value}>{df.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search button */}
        <Button 
          onClick={handleSearch} 
          disabled={isSearching || keywordCount === 0}
          className="w-full h-12 text-base font-medium"
          size="lg"
        >
          {isSearching ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="h-5 w-5 mr-2" />
              Search {keywordCount > 0 ? `${keywordCount} Keywords` : 'Jobs'}
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Searches Workday, SmartRecruiters, iCIMS, Bullhorn, Teamtailor & more ATS platforms
        </p>
      </CardContent>
    </Card>
  );
}