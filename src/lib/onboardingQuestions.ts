export const onboardingQuestions = [
  "What's a happy memory from your childhood?",
  "Who has had a big influence on your life?", 
  "Tell me something you love doing.",
  "What's a place you've always wanted to return to?"
];

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