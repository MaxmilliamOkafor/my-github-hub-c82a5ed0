import { Job } from '@/types';

export const mockJobs: Job[] = [
  {
    id: "1",
    title: "Senior Software Engineer - ML Platform",
    company: "Google",
    location: "London, UK",
    salary: "£120,000 - £180,000",
    postedDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    description: "Build and scale ML infrastructure serving billions of predictions daily. Work on cutting-edge ML systems.",
    requirements: ["Python", "TensorFlow", "Kubernetes", "5+ years experience", "Distributed systems"],
    platform: "Greenhouse",
    url: "https://careers.google.com/jobs/12345",
    matchScore: 95,
    status: "new"
  },
  {
    id: "2",
    title: "Staff Engineer - Data Infrastructure",
    company: "Spotify",
    location: "Stockholm, Sweden",
    salary: "€110,000 - €150,000",
    postedDate: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    description: "Lead the data platform team building real-time streaming pipelines for personalization.",
    requirements: ["Apache Spark", "Kafka", "Python", "AWS", "8+ years experience"],
    platform: "Workday",
    url: "https://jobs.spotify.com/12345",
    matchScore: 92,
    status: "new"
  },
  {
    id: "3",
    title: "Principal ML Engineer",
    company: "Netflix",
    location: "Remote (US/EU)",
    salary: "$200,000 - $350,000",
    postedDate: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    description: "Define ML strategy and build recommendation systems at scale for 230M+ subscribers.",
    requirements: ["PyTorch", "Deep Learning", "Recommendation Systems", "10+ years experience"],
    platform: "Lever",
    url: "https://jobs.netflix.com/12345",
    matchScore: 88,
    status: "new"
  },
  {
    id: "4",
    title: "Senior Backend Engineer",
    company: "Stripe",
    location: "Dublin, Ireland",
    salary: "€130,000 - €180,000",
    postedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    description: "Build payment infrastructure processing trillions of dollars. High reliability systems.",
    requirements: ["Java", "Ruby", "Distributed Systems", "API Design", "6+ years experience"],
    platform: "Greenhouse",
    url: "https://stripe.com/jobs/12345",
    matchScore: 91,
    status: "applied",
    appliedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "5",
    title: "AI/ML Solutions Architect",
    company: "Microsoft",
    location: "London, UK",
    salary: "£100,000 - £160,000",
    postedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    description: "Help enterprise customers adopt Azure AI services. Technical leadership role.",
    requirements: ["Azure", "ML", "Python", "Solution Architecture", "7+ years experience"],
    platform: "iCIMS",
    url: "https://careers.microsoft.com/12345",
    matchScore: 89,
    status: "interviewing"
  },
  {
    id: "6",
    title: "Senior Data Engineer",
    company: "Airbnb",
    location: "San Francisco, CA",
    salary: "$180,000 - $240,000",
    postedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    description: "Build data pipelines powering search, pricing, and trust systems for global marketplace.",
    requirements: ["Spark", "Airflow", "Python", "SQL", "5+ years experience"],
    platform: "Greenhouse",
    url: "https://careers.airbnb.com/12345",
    matchScore: 93,
    status: "new"
  },
  {
    id: "7",
    title: "Platform Engineer - Cloud Native",
    company: "Cloudflare",
    location: "London, UK",
    salary: "£90,000 - £140,000",
    postedDate: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    description: "Build and maintain Kubernetes clusters and developer platform for edge computing.",
    requirements: ["Kubernetes", "Go", "Terraform", "AWS/GCP", "4+ years experience"],
    platform: "Lever",
    url: "https://cloudflare.com/careers/12345",
    matchScore: 86,
    status: "new"
  },
  {
    id: "8",
    title: "Lead Engineer - NLP",
    company: "OpenAI",
    location: "San Francisco, CA / Remote",
    salary: "$250,000 - $400,000",
    postedDate: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    description: "Push the boundaries of natural language understanding and generation models.",
    requirements: ["NLP", "PyTorch", "Transformers", "PhD preferred", "5+ years ML experience"],
    platform: "Ashby",
    url: "https://openai.com/careers/12345",
    matchScore: 85,
    status: "new"
  },
  {
    id: "9",
    title: "Engineering Manager - Data Platform",
    company: "Uber",
    location: "Amsterdam, Netherlands",
    salary: "€140,000 - €200,000",
    postedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    description: "Lead a team of 8-12 engineers building real-time data infrastructure for mobility.",
    requirements: ["People Management", "Spark", "Kafka", "System Design", "8+ years experience"],
    platform: "Workday",
    url: "https://uber.com/careers/12345",
    matchScore: 90,
    status: "offered"
  },
  {
    id: "10",
    title: "Senior Software Engineer - FinTech",
    company: "Revolut",
    location: "London, UK",
    salary: "£100,000 - £150,000",
    postedDate: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    description: "Build core banking systems handling millions of daily transactions globally.",
    requirements: ["Java", "Kotlin", "Microservices", "PostgreSQL", "5+ years experience"],
    platform: "Greenhouse",
    url: "https://revolut.com/careers/12345",
    matchScore: 87,
    status: "new"
  },
  {
    id: "11",
    title: "Staff Machine Learning Engineer",
    company: "Shopify",
    location: "Remote (Anywhere)",
    salary: "$180,000 - $280,000 CAD",
    postedDate: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
    description: "Build ML systems for fraud detection, recommendations, and merchant analytics.",
    requirements: ["Python", "TensorFlow/PyTorch", "ML Production Systems", "6+ years experience"],
    platform: "Lever",
    url: "https://shopify.com/careers/12345",
    matchScore: 94,
    status: "new"
  },
  {
    id: "12",
    title: "Principal Engineer - Infrastructure",
    company: "HashiCorp",
    location: "Remote (EU)",
    salary: "$200,000 - $280,000",
    postedDate: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    description: "Design and build infrastructure products used by millions of developers worldwide.",
    requirements: ["Go", "Terraform", "Kubernetes", "Distributed Systems", "10+ years experience"],
    platform: "Greenhouse",
    url: "https://hashicorp.com/careers/12345",
    matchScore: 84,
    status: "new"
  }
];

export const atsPlatforms = [
  "Workday",
  "SmartRecruiters",
  "Company Website (LinkedIn and Indeed)",
  "Bullhorn",
  "Teamtailor",
  "Workable",
  "iCIMS",
  "Oracle Cloud"
];
