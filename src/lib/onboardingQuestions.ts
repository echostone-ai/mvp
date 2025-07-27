export const dynamicOnboardingQuestions = [
  {
    id: 'childhood_memory',
    title: "A Cherished Memory",
    subtitle: "Let's start with something that makes you smile",
    question: "Tell me about a happy memory from your childhood that still brings you joy today.",
    prompt: "Close your eyes for a moment... what memory makes your heart feel warm?",
    icon: "🌟",
    color: "from-amber-400 to-orange-500",
    category: "memories"
  },
  {
    id: 'life_influence',
    title: "Someone Special",
    subtitle: "The people who shape us",
    question: "Who has had the biggest influence on your life, and what did they teach you?",
    prompt: "Think of someone who changed your perspective or inspired you to grow...",
    icon: "💫",
    color: "from-purple-400 to-pink-500",
    category: "influences"
  },
  {
    id: 'passion_activity',
    title: "What Lights You Up",
    subtitle: "Your spark of joy",
    question: "What's something you absolutely love doing? What makes you lose track of time?",
    prompt: "When you're doing this, the world fades away and you're completely present...",
    icon: "🔥",
    color: "from-red-400 to-rose-500",
    category: "passions"
  },
  {
    id: 'dream_destination',
    title: "A Place That Calls to You",
    subtitle: "Where your heart wants to wander",
    question: "Describe a place you've always wanted to visit or return to. What draws you there?",
    prompt: "Picture yourself there... what do you see, feel, and experience?",
    icon: "🗺️",
    color: "from-blue-400 to-cyan-500",
    category: "places"
  },
  {
    id: 'personal_philosophy',
    title: "Your Life Philosophy",
    subtitle: "What guides your journey",
    question: "What's a belief or principle that guides how you live your life?",
    prompt: "What wisdom would you share with someone just starting their journey?",
    icon: "🧭",
    color: "from-emerald-400 to-teal-500",
    category: "philosophy"
  },
  {
    id: 'creative_expression',
    title: "How You Create",
    subtitle: "Your unique way of expressing yourself",
    question: "How do you like to express your creativity? It could be anything - cooking, writing, problem-solving...",
    prompt: "Everyone creates something unique in this world. What's your way?",
    icon: "🎨",
    color: "from-violet-400 to-purple-500",
    category: "creativity"
  }
];

// Legacy questions for backward compatibility
export const onboardingQuestions = dynamicOnboardingQuestions.map(q => q.question);

export interface OnboardingResponse {
  questionIndex: number;
  question: string;
  audioBlob: Blob;
  transcript?: string;
  analysis?: {
    summary: string;
    tone: string;
    keywords: string[];
    insights: string[];
  };
}

export interface ProfileData {
  early_life: string[];
  influences: string[];
  hobbies: string[];
  places: string[];
  tone: string;
  voice_model_id?: string;
  created_at: string;
}