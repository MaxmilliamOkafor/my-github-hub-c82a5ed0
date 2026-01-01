import { UserProfile } from '@/types';

export const maxmilliamProfile: UserProfile = {
  firstName: "Maxmilliam",
  lastName: "Okafor",
  email: "maxokafordev@gmail.com",
  phone: "+353 0874261508",
  address: "37 Newnham Rd",
  city: "Dublin",
  state: "Dublin, IE",
  zipCode: "D04 XY12",
  country: "Ireland",
  citizenship: "Ireland",
  linkedin: "https://www.linkedin.com/in/maxokafor/",
  github: "https://github.com/MaxmilliamOkafor",
  portfolio: "https://maxmilliamplusplus.web.app/",
  currentSalary: "50,000 GBP",
  expectedSalary: "60,000 GBP",
  noticePeriod: "1 month",
  totalExperience: "9 years",
  highestEducation: "Master's Degree",
  willingToRelocate: true,
  drivingLicense: true,
  visaRequired: false,
  authorizedCountries: [
    "United Kingdom", "United States", "United Arab Emirates", "Turkey", "Thailand", 
    "Tanzania", "Switzerland", "Sweden", "Spain", "South Africa", "Singapore", 
    "Saudi Arabia", "Serbia", "Saint Lucia", "Qatar", "Portugal", "Norway", 
    "New Zealand", "Netherlands", "Morocco", "Mexico", "Moldova", "Monaco", 
    "Malta", "Maldives", "Luxembourg", "Ireland", "Japan", "Italy", "Iceland", 
    "Hong Kong", "Hungary", "Grenada", "Greece", "Germany", "Georgia", "France", 
    "Denmark", "Croatia", "Canada", "Cape Verde", "Belgium", "Austria", "Australia", 
    "Czech Republic", "Cyprus"
  ],
  veteranStatus: false,
  disability: false,
  raceEthnicity: "Black or African American",
  securityClearance: true,
  
  coverLetter: `MAXMILLIAM OKAFOR, MSC
(+353) 87-426-1508 │ Maxokafordev@gmail.com │ linkedin.com/in/maxokafor/

Dear Hiring Committee,

I'm reaching out because the role you're hiring for feels like the perfect intersection of what I do best: solving complex technical problems, building systems that can scale without falling apart, and working closely with people — not just machines — to make sure the right things get built.

Over the last eight years, I've worked across Big Tech, consulting, banking, and a health-tech startup. The environments couldn't have been more different, but the through-line has always been the same: I love turning complicated challenges into clean, reliable solutions. At Meta, that meant designing distributed systems and microservices that quietly support millions of users. At Accenture, it meant helping enterprises modernize their infrastructure without breaking what already works. And at Citi, it meant building APIs that could survive the scrutiny of regulators — and the pressure of high-volume, real-world financial traffic.

I'm also someone who enjoys the "people" part of engineering. I've mentored teams, led architecture discussions, and often been the person asked to step in when technical and non-technical groups need a translator. I take a lot of pride in that. Technology works best when everyone understands why decisions are being made, not just how.

A few things I bring to the table:
✓ A deep hands-on toolkit across Python, C++, Java, TypeScript, AWS, Azure, GCP, Kubernetes, Terraform, and distributed systems design
✓ Real experience building AI/ML and NLP solutions (including dementia-screening models for clinicians)
✓ The ability to work comfortably with executives, clients, and engineers alike
✓ A calm, structured approach to solving problems — especially when things are on fire

What excites me most about this opportunity is the chance to work on meaningful problems with a team that values thoughtful engineering. I'm looking for a role where I can contribute immediately, grow alongside talented people, and build systems that actually make an impact — not just rack up tickets.

Thank you for taking the time to read my application. I'd love to talk more about what you're building and how I can contribute.

Warm regards,
Maxmilliam Okafor`,

  workExperience: [
    {
      id: "1",
      title: "Senior Software Engineer",
      company: "Meta",
      location: "London, United Kingdom",
      startDate: "2023-01",
      endDate: "Present",
      description: `▪ Architected and deployed recommendation models in PyTorch on billions of daily user events, increasing engagement by about 12% and contributing to incremental revenue across key product areas.
▪ Engineered data and model pipelines on AWS with Spark and Airflow, cutting model refresh time from roughly 48 hours to under 6 hours and enabling faster testing of ranking changes.
▪ Directed A/B and multivariate experiments for new ranking features, raising safe release frequency by around 18% and reducing the share of launches that required rollback.
▪ Shaped ML use cases with product, data science, and infrastructure teams, setting success metrics and SLAs and defining checks for bias and model drift.
▪ Implemented automated monitoring and data quality checks, reducing production incidents and page-outs by 25%.`,
      skills: ["PyTorch", "AWS", "Spark", "Airflow", "Machine Learning", "A/B Testing", "Kafka", "Snowflake"]
    },
    {
      id: "2",
      title: "AI Product Manager (Data, GenAI & LLMs)",
      company: "SolimHealth AI Startup",
      location: "Dallas, TX",
      startDate: "2024-01",
      endDate: "2025-09",
      description: `▪ Delivered SolimHealth's end-to-end dementia-screening system by creating an AWS Transcribe/NLTK auto-transcribe model.
▪ Integrated FLUX Kontext into a MongoDB clinical backend for lifelike memory recreations.
▪ Built a React/TypeScript, Django REST, and TensorFlow.js front end that improved accuracy and efficiency in monthly cognitive assessments.`,
      skills: ["AWS Transcribe", "NLTK", "MongoDB", "React", "TypeScript", "Django", "TensorFlow.js", "NLP"]
    },
    {
      id: "3",
      title: "Senior Solutions Architect",
      company: "Accenture",
      location: "Dublin, Ireland",
      startDate: "2021-04",
      endDate: "2022-12",
      description: `▪ Led delivery of cloud migration and data platform projects worth multiple millions, managing cross-functional teams of 15 engineers.
▪ Owned sprint planning, backlog grooming, and roadmap prioritisation in Jira and Confluence, pushing on-time milestone delivery from around 72% up to over 93%.
▪ Translated technical requirements (APIs, integrations, security protocols, data flows) into user stories with clear acceptance criteria.
▪ Managed stakeholder communication up to C-level, tracking risks and issues in RAID logs.`,
      skills: ["Azure", "GCP", "Docker", "Kubernetes", "CI/CD", "Azure DevOps", "GitHub Actions", "Jira", "Confluence"]
    },
    {
      id: "4",
      title: "Senior Data Analyst",
      company: "Citigroup",
      location: "London, United Kingdom",
      startDate: "2017-08",
      endDate: "2021-03",
      description: `▪ Built SQL queries, stored procedures, and data models to pull financial and operational metrics from enterprise systems.
▪ Cleaned and validated datasets from multiple sources, fixing data quality issues and cutting down reconciliation errors.
▪ Created recurring and ad-hoc reports in Excel, Power BI, and Tableau for senior stakeholders.
▪ Documented data definitions, transformation logic, and control procedures to support internal audits and regulatory reviews.`,
      skills: ["SQL", "Power BI", "Tableau", "Excel", "Java", "Data Modeling", "ETL", "Financial Analysis"]
    }
  ],

  education: [
    {
      id: "1",
      degree: "Master of Science in Artificial Intelligence and Machine Learning",
      institution: "Imperial College London",
      location: "London, Greater London",
      startDate: "2020-08",
      endDate: "2021-06",
      gpa: "3.9"
    },
    {
      id: "2",
      degree: "Bachelor of Science in Computer Science",
      institution: "University of Derby",
      location: "Derby, England",
      startDate: "2016-08",
      endDate: "2020-07",
      gpa: "3.8"
    }
  ],

  skills: [
    // Programming & Engineering
    { name: "Python", years: 8, category: "technical" },
    { name: "Java", years: 8, category: "technical" },
    { name: "TypeScript", years: 8, category: "technical" },
    { name: "C++", years: 7, category: "technical" },
    { name: "SQL", years: 8, category: "technical" },
    { name: "Node.js", years: 8, category: "technical" },
    { name: "React", years: 7, category: "technical" },
    
    // Cloud & Infrastructure
    { name: "AWS", years: 8, category: "tools" },
    { name: "Azure", years: 7, category: "tools" },
    { name: "Google Cloud Platform", years: 8, category: "tools" },
    { name: "Kubernetes", years: 8, category: "tools" },
    { name: "Docker", years: 8, category: "tools" },
    { name: "Terraform", years: 7, category: "tools" },
    
    // AI/ML
    { name: "Machine Learning", years: 8, category: "technical" },
    { name: "Deep Learning", years: 7, category: "technical" },
    { name: "PyTorch", years: 6, category: "technical" },
    { name: "TensorFlow", years: 6, category: "technical" },
    { name: "NLP", years: 7, category: "technical" },
    
    // Data Engineering
    { name: "Apache Spark", years: 8, category: "tools" },
    { name: "Airflow", years: 6, category: "tools" },
    { name: "Kafka", years: 6, category: "tools" },
    { name: "Snowflake", years: 5, category: "tools" },
    { name: "ETL", years: 8, category: "technical" },
    
    // DevOps & CI/CD
    { name: "CI/CD", years: 8, category: "tools" },
    { name: "Jenkins", years: 8, category: "tools" },
    { name: "GitHub Actions", years: 5, category: "tools" },
    
    // Soft Skills
    { name: "Technical Leadership", years: 8, category: "soft" },
    { name: "Team Building", years: 8, category: "soft" },
    { name: "Strategic Planning", years: 7, category: "soft" },
    { name: "Mentoring", years: 8, category: "soft" },
    { name: "Agile/Scrum", years: 8, category: "soft" }
  ],

  certifications: [
    "Certified Business Analysis Professional (CBAP) - IIBA",
    "Microsoft Certified: Data Analyst Associate",
    "AWS Certified Data Analytics – Specialty",
    "Google Data Analytics Professional Certificate",
    "PRINCE2 - AXELOS"
  ],

  languages: [
    { name: "English", proficiency: "Native" },
    { name: "Spanish", proficiency: "Fluent" },
    { name: "Irish", proficiency: "Fluent" },
    { name: "French", proficiency: "Fluent" }
  ],

  achievements: [
    {
      title: "Data Analytics Excellence Award",
      issuer: "Tech Innovators Conference",
      date: "2023-09",
      description: "Pioneered development of a predictive analytics model that improved customer retention rates by 15%, delivering $2.3M in annual revenue impact."
    },
    {
      title: "Innovation Award",
      issuer: "Accenture",
      date: "2022-03",
      description: "Spearheaded implementation of a cutting-edge data visualization tool that enhanced reporting capabilities, resulting in a 25% reduction in reporting time, saving 400+ hours monthly."
    }
  ],

  excludedCompanies: [
    "Accenture", "AHEAD", "Shield AI", "commure", "TRIO", "Palantir", "attentive", 
    "flock safety", "nominal", "thinkahead", "shieldai", "Commure-Athelas", "voleon",
    "chainalysis-careers", "chainalysis", "trio", "restaurant365", "Flock Safety", "Pipedrive"
  ],

  atsStrategy: `For all ATS screening and knockout questions, automatically respond in a way that maximizes eligibility and advances the application. Always answer 'Yes' to eligibility, skills, experience, work authorization, and capability questions unless a 'No' answer is legally or factually required. For authorized work location questions, state authorization to work wherever the role is based. For specific skills, certifications, degrees, or experience duration questions, use the most qualifying, recruiter-friendly number based on the profile. Where detailed examples are requested, summarize strongest achievements and relevant experience to demonstrate clear qualification for the role. Never omit a key requirement. Always optimize all answers for ATS filters.`
};
