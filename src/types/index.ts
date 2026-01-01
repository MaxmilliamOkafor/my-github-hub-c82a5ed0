export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  citizenship: string;
  linkedin: string;
  github: string;
  portfolio: string;
  currentSalary: string;
  expectedSalary: string;
  noticePeriod: string;
  totalExperience: string;
  highestEducation: string;
  willingToRelocate: boolean;
  drivingLicense: boolean;
  visaRequired: boolean;
  authorizedCountries: string[];
  veteranStatus: boolean;
  disability: boolean;
  raceEthnicity: string;
  securityClearance: boolean;
  coverLetter: string;
  workExperience: WorkExperience[];
  education: Education[];
  skills: Skill[];
  certifications: string[];
  languages: Language[];
  achievements: Achievement[];
  excludedCompanies: string[];
  atsStrategy: string;
}

export interface WorkExperience {
  id: string;
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
  skills: string[];
}

export interface Education {
  id: string;
  degree: string;
  institution: string;
  location: string;
  startDate: string;
  endDate: string;
  gpa: string;
}

export interface Skill {
  name: string;
  years: number;
  category: 'technical' | 'soft' | 'tools' | 'languages';
}

export interface Language {
  name: string;
  proficiency: 'Native' | 'Fluent' | 'Intermediate' | 'Basic';
}

export interface Achievement {
  title: string;
  issuer: string;
  date: string;
  description: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  postedDate: string;
  description: string;
  requirements: string[];
  platform: string;
  url: string;
  matchScore: number;
  status: 'new' | 'applied' | 'interviewing' | 'offered' | 'rejected';
  appliedAt?: string;
}

export interface KeywordMonitor {
  id: string;
  keywords: string[];
  roles: string[];
  locations: string[];
  enabled: boolean;
  autoApply: boolean;
  minMatchScore: number;
}

export interface AutoApplySettings {
  enabled: boolean;
  minMatchScore: number;
  applyWithinMinutes: number;
  platforms: string[];
  keywordMonitors: KeywordMonitor[];
}

export interface ApplicationStats {
  applied: number;
  interviewing: number;
  offered: number;
  rejected: number;
  pending: number;
}
