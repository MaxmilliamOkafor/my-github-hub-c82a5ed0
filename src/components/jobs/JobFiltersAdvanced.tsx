import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Building2, Briefcase, DollarSign, X } from 'lucide-react';

interface Job {
  id: string;
  company: string;
  platform: string | null;
  salary: string | null;
}

interface JobFiltersAdvancedProps {
  jobs: Job[];
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  companyFilter: string;
  onCompanyFilterChange: (value: string) => void;
  platformFilter: string;
  onPlatformFilterChange: (value: string) => void;
  salaryFilter: string;
  onSalaryFilterChange: (value: string) => void;
  onClearFilters: () => void;
}

const SALARY_RANGES = [
  { value: 'all', label: 'Any Salary' },
  { value: '100k+', label: '$100k+' },
  { value: '150k+', label: '$150k+' },
  { value: '200k+', label: '$200k+' },
  { value: '250k+', label: '$250k+' },
  { value: '300k+', label: '$300k+' },
];

export function JobFiltersAdvanced({
  jobs,
  searchTerm,
  onSearchTermChange,
  companyFilter,
  onCompanyFilterChange,
  platformFilter,
  onPlatformFilterChange,
  salaryFilter,
  onSalaryFilterChange,
  onClearFilters,
}: JobFiltersAdvancedProps) {
  // Extract unique companies from jobs
  const companies = useMemo(() => {
    const uniqueCompanies = new Set<string>();
    jobs.forEach(job => {
      if (job.company && job.company !== 'Unknown Company') {
        uniqueCompanies.add(job.company);
      }
    });
    return Array.from(uniqueCompanies).sort();
  }, [jobs]);

  // Extract unique platforms from jobs
  const platforms = useMemo(() => {
    const uniquePlatforms = new Set<string>();
    jobs.forEach(job => {
      if (job.platform) {
        uniquePlatforms.add(job.platform);
      }
    });
    return Array.from(uniquePlatforms).sort();
  }, [jobs]);

  const hasActiveFilters = searchTerm || companyFilter !== 'all' || platformFilter !== 'all' || salaryFilter !== 'all';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search by title/keyword */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by title..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="pl-10 h-10"
          />
        </div>

        {/* Company filter */}
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <Select value={companyFilter} onValueChange={onCompanyFilterChange}>
            <SelectTrigger className="pl-10 h-10">
              <SelectValue placeholder="Company" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="all">All Companies</SelectItem>
              {companies.slice(0, 50).map(company => (
                <SelectItem key={company} value={company}>{company}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Platform filter */}
        <div className="relative">
          <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <Select value={platformFilter} onValueChange={onPlatformFilterChange}>
            <SelectTrigger className="pl-10 h-10">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {platforms.map(platform => (
                <SelectItem key={platform} value={platform}>{platform}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Salary filter */}
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <Select value={salaryFilter} onValueChange={onSalaryFilterChange}>
            <SelectTrigger className="pl-10 h-10">
              <SelectValue placeholder="Salary" />
            </SelectTrigger>
            <SelectContent>
              {SALARY_RANGES.map(range => (
                <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active filters badges */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Active filters:</span>
          {searchTerm && (
            <Badge variant="secondary" className="text-xs">
              Title: {searchTerm}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => onSearchTermChange('')} />
            </Badge>
          )}
          {companyFilter !== 'all' && (
            <Badge variant="secondary" className="text-xs">
              Company: {companyFilter}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => onCompanyFilterChange('all')} />
            </Badge>
          )}
          {platformFilter !== 'all' && (
            <Badge variant="secondary" className="text-xs">
              Platform: {platformFilter}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => onPlatformFilterChange('all')} />
            </Badge>
          )}
          {salaryFilter !== 'all' && (
            <Badge variant="secondary" className="text-xs">
              Salary: {salaryFilter}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => onSalaryFilterChange('all')} />
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-6 text-xs">
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}