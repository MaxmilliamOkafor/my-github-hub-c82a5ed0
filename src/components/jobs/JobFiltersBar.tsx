import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  Building2, 
  MapPin, 
  Clock, 
  Filter, 
  X,
  Briefcase,
  Home,
  GraduationCap,
  RefreshCw,
} from 'lucide-react';
import { Job } from '@/hooks/useJobs';

interface JobFiltersBarProps {
  jobs: Job[];
  onFiltersChange: (filteredJobs: Job[]) => void;
  onSearch?: (keywords: string, locations: string, filters: SearchFilters) => Promise<void>;
  onLocationChange?: (locations: string[]) => Promise<void>;
  isSearching?: boolean;
}

export interface SearchFilters {
  timeFilter: TimeFilter;
  jobType: string;
  workType: string;
  experienceLevel: string;
}

type TimeFilter = '10min' | '30min' | '1h' | '2h' | '6h' | 'today' | 'week' | 'all';

const TIME_OPTIONS: { value: TimeFilter; label: string; ms: number }[] = [
  { value: '10min', label: '10 min', ms: 10 * 60 * 1000 },
  { value: '30min', label: '30 min', ms: 30 * 60 * 1000 },
  { value: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
  { value: '2h', label: '2 hours', ms: 2 * 60 * 60 * 1000 },
  { value: '6h', label: '6 hours', ms: 6 * 60 * 60 * 1000 },
  { value: 'today', label: 'Today', ms: 24 * 60 * 60 * 1000 },
  { value: 'week', label: 'This Week', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: 'all', label: 'All Time', ms: Infinity },
];

const JOB_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'Full-time', label: 'Full-time' },
  { value: 'Part-time', label: 'Part-time' },
  { value: 'Contract', label: 'Contract' },
  { value: 'Internship', label: 'Internship' },
  { value: 'Freelance', label: 'Freelance' },
];

const WORK_TYPES = [
  { value: 'all', label: 'All Work Types' },
  { value: 'Remote', label: 'Remote' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'On-site', label: 'On-site' },
];

const EXPERIENCE_LEVELS = [
  { value: 'all', label: 'All Levels' },
  { value: 'Entry Level', label: 'Entry Level' },
  { value: 'Mid Level', label: 'Mid Level' },
  { value: 'Senior', label: 'Senior' },
  { value: 'Lead', label: 'Lead' },
  { value: 'Executive', label: 'Executive' },
];

// ATS Platforms - Updated list
const ATS_PLATFORMS = [
  'all',
  'Greenhouse',
  'Workday',
  'SmartRecruiters',
  'Company Website (LinkedIn and Indeed)',
  'Bullhorn',
  'Teamtailor',
  'Workable',
  'ICIMS',
  'Oracle Cloud',
  'Career Page',
  'Other',
];

const LOCATION_OPTIONS = [
  // Remote/Hybrid
  { value: 'remote', label: 'Remote', group: 'Work Type' },
  { value: 'hybrid', label: 'Hybrid', group: 'Work Type' },
  // Europe
  { value: 'Ireland', label: 'Ireland', group: 'Europe' },
  { value: 'Dublin', label: 'Dublin', group: 'Europe' },
  { value: 'United Kingdom', label: 'United Kingdom', group: 'Europe' },
  { value: 'London', label: 'London', group: 'Europe' },
  { value: 'Germany', label: 'Germany', group: 'Europe' },
  { value: 'Berlin', label: 'Berlin', group: 'Europe' },
  { value: 'Munich', label: 'Munich', group: 'Europe' },
  { value: 'Netherlands', label: 'Netherlands', group: 'Europe' },
  { value: 'Amsterdam', label: 'Amsterdam', group: 'Europe' },
  { value: 'France', label: 'France', group: 'Europe' },
  { value: 'Paris', label: 'Paris', group: 'Europe' },
  { value: 'Switzerland', label: 'Switzerland', group: 'Europe' },
  { value: 'Zurich', label: 'Zurich', group: 'Europe' },
  { value: 'Sweden', label: 'Sweden', group: 'Europe' },
  { value: 'Stockholm', label: 'Stockholm', group: 'Europe' },
  { value: 'Spain', label: 'Spain', group: 'Europe' },
  { value: 'Barcelona', label: 'Barcelona', group: 'Europe' },
  { value: 'Madrid', label: 'Madrid', group: 'Europe' },
  { value: 'Belgium', label: 'Belgium', group: 'Europe' },
  { value: 'Austria', label: 'Austria', group: 'Europe' },
  { value: 'Czech Republic', label: 'Czech Republic', group: 'Europe' },
  { value: 'Portugal', label: 'Portugal', group: 'Europe' },
  { value: 'Lisbon', label: 'Lisbon', group: 'Europe' },
  { value: 'Italy', label: 'Italy', group: 'Europe' },
  { value: 'Greece', label: 'Greece', group: 'Europe' },
  { value: 'Norway', label: 'Norway', group: 'Europe' },
  { value: 'Denmark', label: 'Denmark', group: 'Europe' },
  { value: 'Finland', label: 'Finland', group: 'Europe' },
  { value: 'Poland', label: 'Poland', group: 'Europe' },
  { value: 'Luxembourg', label: 'Luxembourg', group: 'Europe' },
  { value: 'Malta', label: 'Malta', group: 'Europe' },
  { value: 'Cyprus', label: 'Cyprus', group: 'Europe' },
  { value: 'Serbia', label: 'Serbia', group: 'Europe' },
  { value: 'EMEA', label: 'EMEA', group: 'Europe' },
  // Americas
  { value: 'United States', label: 'United States', group: 'Americas' },
  { value: 'New York', label: 'New York', group: 'Americas' },
  { value: 'San Francisco', label: 'San Francisco', group: 'Americas' },
  { value: 'Seattle', label: 'Seattle', group: 'Americas' },
  { value: 'Austin', label: 'Austin', group: 'Americas' },
  { value: 'Boston', label: 'Boston', group: 'Americas' },
  { value: 'Chicago', label: 'Chicago', group: 'Americas' },
  { value: 'Los Angeles', label: 'Los Angeles', group: 'Americas' },
  { value: 'Denver', label: 'Denver', group: 'Americas' },
  { value: 'Atlanta', label: 'Atlanta', group: 'Americas' },
  { value: 'Canada', label: 'Canada', group: 'Americas' },
  { value: 'Toronto', label: 'Toronto', group: 'Americas' },
  { value: 'Vancouver', label: 'Vancouver', group: 'Americas' },
  { value: 'Montreal', label: 'Montreal', group: 'Americas' },
  { value: 'Mexico', label: 'Mexico', group: 'Americas' },
  // Middle East
  { value: 'United Arab Emirates', label: 'United Arab Emirates', group: 'Middle East' },
  { value: 'Dubai', label: 'Dubai', group: 'Middle East' },
  { value: 'Abu Dhabi', label: 'Abu Dhabi', group: 'Middle East' },
  { value: 'Qatar', label: 'Qatar', group: 'Middle East' },
  { value: 'Saudi Arabia', label: 'Saudi Arabia', group: 'Middle East' },
  { value: 'Israel', label: 'Israel', group: 'Middle East' },
  { value: 'Turkey', label: 'Turkey', group: 'Middle East' },
  // Africa
  { value: 'South Africa', label: 'South Africa', group: 'Africa' },
  { value: 'Morocco', label: 'Morocco', group: 'Africa' },
  { value: 'Egypt', label: 'Egypt', group: 'Africa' },
  { value: 'Nigeria', label: 'Nigeria', group: 'Africa' },
  { value: 'Kenya', label: 'Kenya', group: 'Africa' },
  { value: 'Tanzania', label: 'Tanzania', group: 'Africa' },
  // Asia Pacific
  { value: 'Singapore', label: 'Singapore', group: 'Asia Pacific' },
  { value: 'Japan', label: 'Japan', group: 'Asia Pacific' },
  { value: 'Tokyo', label: 'Tokyo', group: 'Asia Pacific' },
  { value: 'Australia', label: 'Australia', group: 'Asia Pacific' },
  { value: 'Sydney', label: 'Sydney', group: 'Asia Pacific' },
  { value: 'Melbourne', label: 'Melbourne', group: 'Asia Pacific' },
  { value: 'New Zealand', label: 'New Zealand', group: 'Asia Pacific' },
  { value: 'Hong Kong', label: 'Hong Kong', group: 'Asia Pacific' },
  { value: 'India', label: 'India', group: 'Asia Pacific' },
  { value: 'Bangalore', label: 'Bangalore', group: 'Asia Pacific' },
  { value: 'Thailand', label: 'Thailand', group: 'Asia Pacific' },
  { value: 'Vietnam', label: 'Vietnam', group: 'Asia Pacific' },
  { value: 'Philippines', label: 'Philippines', group: 'Asia Pacific' },
  { value: 'APAC', label: 'APAC', group: 'Asia Pacific' },
];

export function JobFiltersBar({ jobs, onFiltersChange, onSearch, onLocationChange, isSearching }: JobFiltersBarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [quickFilter, setQuickFilter] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'applied'>('all');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedJobType, setSelectedJobType] = useState('all');
  const [selectedWorkType, setSelectedWorkType] = useState('all');
  const [selectedExperienceLevel, setSelectedExperienceLevel] = useState('all');
  const [locationPopoverOpen, setLocationPopoverOpen] = useState(false);
  const [isFilteringByLocation, setIsFilteringByLocation] = useState(false);

  // Extract unique values
  const uniquePlatforms = useMemo(() => 
    [...new Set(jobs.map(j => j.platform).filter(Boolean))] as string[],
  [jobs]);

  // Calculate stats
  const jobStats = useMemo(() => {
    const applied = jobs.filter(j => j.status === 'applied').length;
    const pending = jobs.filter(j => j.status === 'pending').length;
    
    const platforms: Record<string, number> = {};
    jobs.forEach(j => {
      if (j.platform) platforms[j.platform] = (platforms[j.platform] || 0) + 1;
    });
    
    return { applied, pending, platforms };
  }, [jobs]);

  // Filter jobs
  const filteredJobs = useMemo(() => {
    const now = Date.now();
    const timeOption = TIME_OPTIONS.find(t => t.value === timeFilter);
    const maxAge = timeOption?.ms ?? Infinity;
    
    const filtered = jobs.filter(job => {
      // Time filter
      if (maxAge !== Infinity) {
        const jobTime = new Date(job.posted_date).getTime();
        if (now - jobTime > maxAge) return false;
      }
      
      // Quick filter (client-side text search)
      if (quickFilter) {
        const searchLower = quickFilter.toLowerCase();
        const matchesSearch = 
          job.title.toLowerCase().includes(searchLower) ||
          job.company.toLowerCase().includes(searchLower) ||
          job.location.toLowerCase().includes(searchLower) ||
          (job.description?.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }
      
      // Location filter (multi-select) - skip if server-side filtering is being used
      // When onLocationChange is provided, filtering is done server-side
      if (selectedLocations.length > 0 && !onLocationChange) {
        const locationLower = job.location.toLowerCase();
        const matchesAnyLocation = selectedLocations.some(loc => 
          locationLower.includes(loc.toLowerCase())
        );
        if (!matchesAnyLocation) return false;
      }
      
      // Platform filter
      if (platformFilter !== 'all' && job.platform !== platformFilter) return false;
      
      // Status filter
      if (statusFilter !== 'all' && job.status !== statusFilter) return false;
      
      // Job type filter (check in title or description)
      if (selectedJobType !== 'all') {
        const jobText = `${job.title} ${job.description || ''}`.toLowerCase();
        if (!jobText.includes(selectedJobType.toLowerCase())) return false;
      }
      
      // Work type filter
      if (selectedWorkType !== 'all') {
        const jobText = `${job.title} ${job.location} ${job.description || ''}`.toLowerCase();
        if (!jobText.includes(selectedWorkType.toLowerCase())) return false;
      }
      
      // Experience level filter
      if (selectedExperienceLevel !== 'all') {
        const jobText = `${job.title} ${job.description || ''}`.toLowerCase();
        const levelLower = selectedExperienceLevel.toLowerCase();
        const hasLevel = jobText.includes(levelLower) || 
          (levelLower === 'senior' && (jobText.includes('sr.') || jobText.includes('sr '))) ||
          (levelLower === 'entry level' && (jobText.includes('junior') || jobText.includes('jr.')));
        if (!hasLevel) return false;
      }
      
      return true;
    }).sort((a, b) => b.match_score - a.match_score);
    
    onFiltersChange(filtered);
    return filtered;
  }, [jobs, timeFilter, quickFilter, selectedLocations, platformFilter, statusFilter, 
      selectedJobType, selectedWorkType, selectedExperienceLevel, onFiltersChange]);

  const activeFiltersCount = [
    quickFilter,
    selectedLocations.length > 0,
    platformFilter !== 'all',
    statusFilter !== 'all',
    selectedJobType !== 'all',
    selectedWorkType !== 'all',
    selectedExperienceLevel !== 'all',
  ].filter(Boolean).length;

  const handleApiSearch = async () => {
    if (searchTerm && onSearch) {
      const locationsStr = selectedLocations.length > 0 
        ? selectedLocations.join(', ') 
        : '';
      
      const filters: SearchFilters = {
        timeFilter,
        jobType: selectedJobType,
        workType: selectedWorkType,
        experienceLevel: selectedExperienceLevel,
      };
      
      await onSearch(searchTerm, locationsStr, filters);
    }
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setQuickFilter('');
    setTimeFilter('all');
    setPlatformFilter('all');
    setStatusFilter('all');
    setSelectedLocations([]);
    setSelectedJobType('all');
    setSelectedWorkType('all');
    setSelectedExperienceLevel('all');
  };

  const toggleLocation = async (location: string) => {
    const newLocations = selectedLocations.includes(location) 
      ? selectedLocations.filter(l => l !== location)
      : [...selectedLocations, location];
    
    setSelectedLocations(newLocations);
    
    // Trigger server-side location filter if callback provided
    if (onLocationChange && newLocations.length > 0) {
      setIsFilteringByLocation(true);
      try {
        await onLocationChange(newLocations);
      } finally {
        setIsFilteringByLocation(false);
      }
    } else if (onLocationChange && newLocations.length === 0) {
      // Reset to all jobs when no locations selected
      setIsFilteringByLocation(true);
      try {
        await onLocationChange([]);
      } finally {
        setIsFilteringByLocation(false);
      }
    }
  };

  // Group locations by region
  const groupedLocations = useMemo(() => {
    const groups: Record<string, typeof LOCATION_OPTIONS> = {};
    LOCATION_OPTIONS.forEach(loc => {
      if (!groups[loc.group]) groups[loc.group] = [];
      groups[loc.group].push(loc);
    });
    return groups;
  }, []);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Search Row */}
        <div className="space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Keywords Search */}
            <div className="flex-1 space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4" />
                Keywords (comma-separated)
              </Label>
              <Textarea
                placeholder="Data Scientist, Machine Learning Engineer, Python Developer, AI Researcher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="min-h-[80px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {searchTerm.split(',').filter(k => k.trim()).length} keyword(s) entered
              </p>
            </div>
          </div>
          
          {/* Filter Row 1: Time, Job Type, Work Type, Experience */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Time Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Posted Within
              </Label>
              <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Job Type */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                Job Type
              </Label>
              <Select value={selectedJobType} onValueChange={setSelectedJobType}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_TYPES.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Work Type */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Home className="h-3 w-3" />
                Work Type
              </Label>
              <Select value={selectedWorkType} onValueChange={setSelectedWorkType}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_TYPES.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Experience Level */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <GraduationCap className="h-3 w-3" />
                Experience
              </Label>
              <Select value={selectedExperienceLevel} onValueChange={setSelectedExperienceLevel}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPERIENCE_LEVELS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Filter Row 2: Location, Platform, Status */}
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Location Multi-Select */}
            <Popover open={locationPopoverOpen} onOpenChange={setLocationPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full lg:w-[220px] justify-start gap-2 h-9">
                  <MapPin className="h-4 w-4" />
                  <span className="truncate">
                    {selectedLocations.length === 0 
                      ? 'Select Locations' 
                      : selectedLocations.length === 1 
                        ? selectedLocations[0]
                        : `${selectedLocations.length} locations`}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3 max-h-96 overflow-y-auto" align="start">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b">
                    <span className="text-sm font-medium">Select Locations</span>
                    {selectedLocations.length > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs"
                        onClick={async () => {
                          setSelectedLocations([]);
                          if (onLocationChange) {
                            setIsFilteringByLocation(true);
                            try {
                              await onLocationChange([]);
                            } finally {
                              setIsFilteringByLocation(false);
                            }
                          }
                        }}
                      >
                        Clear All
                      </Button>
                    )}
                  </div>
                  
                  {/* Selected locations */}
                  {selectedLocations.length > 0 && (
                    <div className="flex flex-wrap gap-1 pb-2 border-b">
                      {selectedLocations.map(loc => (
                        <Badge 
                          key={loc} 
                          variant="secondary" 
                          className="text-xs cursor-pointer"
                          onClick={() => toggleLocation(loc)}
                        >
                          {loc} <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {/* Grouped locations */}
                  {Object.entries(groupedLocations).map(([group, locations]) => (
                    <div key={group} className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {group}
                      </p>
                      <div className="grid grid-cols-2 gap-1">
                        {locations.map(loc => (
                          <div 
                            key={loc.value} 
                            className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted rounded px-2"
                            onClick={() => toggleLocation(loc.value)}
                          >
                            <Checkbox 
                              checked={selectedLocations.includes(loc.value)}
                              className="h-3.5 w-3.5 pointer-events-none"
                              aria-hidden="true"
                            />
                            <span className="text-xs">{loc.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            
            {/* Platform */}
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-full lg:w-[200px] h-9">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                {ATS_PLATFORMS.filter(p => p !== 'all').map(platform => (
                  <SelectItem key={platform} value={platform}>
                    {platform} {jobStats.platforms[platform] ? `(${jobStats.platforms[platform]})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Status */}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'pending' | 'applied')}>
              <SelectTrigger className="w-full lg:w-[140px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending ({jobStats.pending})</SelectItem>
                <SelectItem value="applied">Applied ({jobStats.applied})</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Search Button */}
            <Button 
              onClick={handleApiSearch} 
              disabled={!searchTerm.trim() || isSearching} 
              className="lg:ml-auto h-9"
            >
              {isSearching ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Search Jobs
            </Button>
            
            {/* Clear Filters */}
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9">
                <X className="h-4 w-4 mr-1" />
                Clear ({activeFiltersCount})
              </Button>
            )}
          </div>
        </div>
        
        {/* Results Summary */}
        <div className="flex items-center justify-between text-sm border-t pt-3">
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">
              Showing <strong>{filteredJobs.length}</strong> of <strong>{jobs.length}</strong> jobs
            </span>
            {selectedLocations.length > 0 && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {selectedLocations.slice(0, 3).join(', ')}
                  {selectedLocations.length > 3 && ` +${selectedLocations.length - 3} more`}
                </span>
              </div>
            )}
          </div>
          
          {/* Quick Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Quick filter results..."
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              className="text-sm bg-transparent border-none outline-none w-40 placeholder:text-muted-foreground"
            />
            {quickFilter && (
              <button onClick={() => setQuickFilter('')}>
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
