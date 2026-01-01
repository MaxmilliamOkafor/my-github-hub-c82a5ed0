import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin, Calendar } from 'lucide-react';

interface JobFiltersProps {
  /** When false, hides the inline search input (useful when bulk keyword search is the only search bar). */
  showSearch?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  location: string;
  onLocationChange: (value: string) => void;
  dateFilter: string;
  onDateFilterChange: (value: string) => void;
}

export function JobFilters({
  showSearch = true,
  search,
  onSearchChange,
  location,
  onLocationChange,
  dateFilter,
  onDateFilterChange
}: JobFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {showSearch && (
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, company, or keywords..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      )}
      
      <div className="flex gap-3">
        <div className="relative w-40">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <Select value={location} onValueChange={onLocationChange}>
            <SelectTrigger className="pl-10">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="london">London, UK</SelectItem>
              <SelectItem value="dublin">Dublin, Ireland</SelectItem>
              <SelectItem value="amsterdam">Amsterdam, NL</SelectItem>
              <SelectItem value="remote">Remote</SelectItem>
              <SelectItem value="usa">United States</SelectItem>
              <SelectItem value="europe">Europe</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="relative w-40">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <Select value={dateFilter} onValueChange={onDateFilterChange}>
            <SelectTrigger className="pl-10">
              <SelectValue placeholder="Posted" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Time</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="3d">Last 3 Days</SelectItem>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
