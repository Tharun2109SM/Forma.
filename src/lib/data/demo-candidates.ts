export type CandidateResult = {
  id: string;
  rank: number;
  name: string;
  email: string | null;
  resumeFilename: string;
  semanticScore: number;
  keywordScore: number;
  skillScore: number;
  finalScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  explanation: string | null;
  evidence: string[];
};

export const demoCandidates: CandidateResult[] = [
  {
    id: "arjun-sharma",
    rank: 1,
    name: "Arjun Sharma",
    email: "arjun.sharma@example.com",
    resumeFilename: "arjun_sharma_resume.pdf",
    semanticScore: 94,
    keywordScore: 92,
    skillScore: 89,
    finalScore: 92.4,
    matchedSkills: ["React", "TypeScript", "Node.js", "PostgreSQL", "REST APIs"],
    missingSkills: ["Kubernetes"],
    explanation:
      "Arjun combines highly relevant product-engineering experience with explicit evidence across the role’s core stack. His strongest evidence is recent React and TypeScript ownership, supported by production API and PostgreSQL work.",
    evidence: [
      "Led a React and TypeScript migration across a customer-facing platform.",
      "Designed Node.js REST APIs backed by PostgreSQL.",
    ],
  },
  {
    id: "maya-reddy",
    rank: 2,
    name: "Maya Reddy",
    email: "maya.reddy@example.com",
    resumeFilename: "maya_reddy_cv.pdf",
    semanticScore: 91,
    keywordScore: 87,
    skillScore: 85,
    finalScore: 88.6,
    matchedSkills: ["React", "Next.js", "TypeScript", "Design systems"],
    missingSkills: ["Node.js", "Kubernetes"],
    explanation:
      "Maya’s frontend architecture and design-system work align closely with the role. The score is held below the top match because the resume has limited explicit backend ownership and no Kubernetes evidence.",
    evidence: [
      "Built a reusable React component system used by six product squads.",
      "Shipped Next.js applications with strict TypeScript standards.",
    ],
  },
  {
    id: "rohan-shah",
    rank: 3,
    name: "Rohan Shah",
    email: "rohan.shah@example.com",
    resumeFilename: "rohan_shah_2026.pdf",
    semanticScore: 88,
    keywordScore: 82,
    skillScore: 83,
    finalScore: 85.2,
    matchedSkills: ["React", "JavaScript", "Node.js", "REST APIs"],
    missingSkills: ["TypeScript", "Kubernetes"],
    explanation:
      "Rohan shows broad full-stack relevance and direct Node.js API experience. His ranking reflects strong semantic alignment, with a material gap in explicit TypeScript evidence.",
    evidence: [
      "Developed full-stack applications using React and Node.js.",
      "Owned REST API integrations for payment and identity services.",
    ],
  },
  {
    id: "priya-nair",
    rank: 4,
    name: "Priya Nair",
    email: "priya.nair@example.com",
    resumeFilename: "priya_nair_resume.pdf",
    semanticScore: 86,
    keywordScore: 80,
    skillScore: 78,
    finalScore: 82.6,
    matchedSkills: ["React", "TypeScript", "GraphQL"],
    missingSkills: ["PostgreSQL", "Kubernetes"],
    explanation: null,
    evidence: ["Built React dashboards and GraphQL data experiences for B2B teams."],
  },
  {
    id: "vikram-singh",
    rank: 5,
    name: "Vikram Singh",
    email: "vikram.singh@example.com",
    resumeFilename: "vikram_singh.pdf",
    semanticScore: 82,
    keywordScore: 84,
    skillScore: 76,
    finalScore: 81.4,
    matchedSkills: ["Node.js", "PostgreSQL", "TypeScript"],
    missingSkills: ["React", "Kubernetes"],
    explanation: null,
    evidence: ["Designed TypeScript services and PostgreSQL data models."],
  },
  {
    id: "sara-khan",
    rank: 6,
    name: "Sara Khan",
    email: "sara.khan@example.com",
    resumeFilename: "sara_khan_resume.pdf",
    semanticScore: 84,
    keywordScore: 75,
    skillScore: 80,
    finalScore: 80.5,
    matchedSkills: ["React", "JavaScript", "Accessibility"],
    missingSkills: ["Node.js", "PostgreSQL"],
    explanation: null,
    evidence: ["Delivered accessible React interfaces for a high-traffic marketplace."],
  },
  {
    id: "neil-dsouza",
    rank: 7,
    name: "Neil D’Souza",
    email: "neil.dsouza@example.com",
    resumeFilename: "neil_dsouza.pdf",
    semanticScore: 77,
    keywordScore: 79,
    skillScore: 74,
    finalScore: 77,
    matchedSkills: ["React", "Node.js", "AWS"],
    missingSkills: ["TypeScript", "PostgreSQL"],
    explanation: null,
    evidence: ["Maintained React and Node.js features in a cloud platform."],
  },
  {
    id: "aditi-mehta",
    rank: 8,
    name: "Aditi Mehta",
    email: "aditi.mehta@example.com",
    resumeFilename: "aditi_mehta_cv.pdf",
    semanticScore: 80,
    keywordScore: 68,
    skillScore: 72,
    finalScore: 74.8,
    matchedSkills: ["React", "JavaScript", "CSS"],
    missingSkills: ["TypeScript", "Node.js", "PostgreSQL"],
    explanation: null,
    evidence: ["Built responsive React experiences for consumer products."],
  },
];
