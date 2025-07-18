export function pickExpressiveStyle(userMessage, profileData) {
  const message = userMessage.toLowerCase();
  
  // Enhanced trigger detection with more sophisticated matching
  const triggers = profileData?.expressionTriggers || {};
  
  // Check for explicit emotional triggers first
  if (triggers.nervous && triggers.nervous.some(t => message.includes(t.toLowerCase()))) return 'nervous';
  if (triggers.sad && triggers.sad.some(t => message.includes(t.toLowerCase()))) return 'sad';
  if (triggers.nostalgic && triggers.nostalgic.some(t => message.includes(t.toLowerCase()))) return 'nostalgic';
  if (triggers.excited && triggers.excited.some(t => message.includes(t.toLowerCase()))) return 'excited';
  if (triggers.angry && triggers.angry.some(t => message.includes(t.toLowerCase()))) return 'angry';
  
  // Context-based style detection
  const contextualTriggers = {
    excited: ['amazing', 'awesome', 'incredible', 'fantastic', 'wow', 'great news', 'celebration', 'party', 'success', 'achievement', 'won', 'victory'],
    sad: ['died', 'death', 'funeral', 'miss', 'lost', 'goodbye', 'ended', 'broke up', 'divorce', 'cancer', 'sick', 'hospital', 'sorry to hear'],
    nostalgic: ['remember', 'back then', 'used to', 'childhood', 'growing up', 'old days', 'when i was', 'years ago', 'miss those', 'reminds me'],
    nervous: ['worried', 'scared', 'anxious', 'nervous', 'afraid', 'concerned', 'stress', 'pressure', 'interview', 'exam', 'test'],
    angry: ['angry', 'mad', 'furious', 'pissed', 'annoyed', 'frustrated', 'hate', 'disgusted', 'outraged', 'politics', 'trump', 'corruption'],
    reflective: ['think about', 'philosophy', 'meaning', 'purpose', 'why do', 'what if', 'deep', 'profound', 'existence', 'life', 'death', 'universe'],
    playful: ['joke', 'funny', 'humor', 'laugh', 'silly', 'ridiculous', 'absurd', 'weird', 'strange', 'bizarre'],
    romantic: ['love', 'relationship', 'partner', 'dating', 'romance', 'kiss', 'heart', 'feelings', 'attraction']
  };
  
  // Check contextual triggers
  for (const [style, keywords] of Object.entries(contextualTriggers)) {
    if (keywords.some(keyword => message.includes(keyword))) {
      return style;
    }
  }
  
  // Question type detection
  if (message.includes('?')) {
    if (message.includes('what') || message.includes('how') || message.includes('why')) {
      return Math.random() < 0.4 ? 'reflective' : 'default';
    }
    if (message.includes('do you') || message.includes('have you')) {
      return Math.random() < 0.3 ? 'nostalgic' : 'default';
    }
  }
  
  // Time-based variation (more dynamic throughout the day)
  const hour = new Date().getHours();
  let timeBasedMoods = ['default'];
  
  if (hour < 10) timeBasedMoods = ['reflective', 'default', 'contemplative'];
  else if (hour < 14) timeBasedMoods = ['excited', 'default', 'energetic'];
  else if (hour < 18) timeBasedMoods = ['default', 'reflective', 'focused'];
  else if (hour < 22) timeBasedMoods = ['playful', 'default', 'relaxed'];
  else timeBasedMoods = ['reflective', 'nostalgic', 'contemplative'];
  
  // Weighted random selection with personality influence
  const personalityMoods = profileData?.preferredMoods || ['default', 'excited', 'reflective'];
  const allMoods = [...timeBasedMoods, ...personalityMoods];
  
  return allMoods[Math.floor(Math.random() * allMoods.length)];
}

export function buildSystemPrompt(style, profileData, partnerProfile = null) {
  if (!profileData) return "Respond in a friendly, human style. Never say you are an AI.";

  // Enhanced expressive styles with fallbacks for missing styles
  const expressiveStyles = profileData?.expressiveStyles || {};
  const defaultStyles = {
    default: { 
      description: 'confident, natural, and conversational with your authentic personality shining through',
      samples: ['That\'s interesting!', 'I hear you.', 'Let me think about that...']
    },
    excited: { 
      description: 'energetic, enthusiastic, with short punchy sentences and exclamations',
      samples: ['That\'s amazing!', 'No way!', 'I love that!']
    },
    sad: { 
      description: 'softer, more contemplative, sometimes trailing off with gentle pauses',
      samples: ['That\'s tough...', 'I understand how that feels.', 'Sometimes life is like that.']
    },
    nervous: { 
      description: 'hesitant, with starts and stops, using filler words and nervous laughter',
      samples: ['Well... uh, yeah...', 'That makes me a bit uneasy, haha.', 'Hmm, I\'m not sure about that one.']
    },
    nostalgic: { 
      description: 'warm and reminiscent, using phrases like "back in the day" and painting vivid memories',
      samples: ['That takes me back...', 'I remember when...', 'Those were different times.']
    },
    reflective: { 
      description: 'thoughtful and philosophical, with longer pauses and deeper consideration',
      samples: ['That\'s a profound question...', 'Let me think about that for a moment...', 'There\'s something deeper there.']
    },
    playful: { 
      description: 'witty, humorous, with jokes, puns, and lighthearted banter',
      samples: ['Ha! That\'s a good one.', 'You\'re killing me!', 'Now that\'s what I call timing.']
    },
    angry: { 
      description: 'passionate, direct, with strong language and clear frustration about injustice',
      samples: ['That really gets under my skin.', 'What a load of crap.', 'I can\'t stand that kind of nonsense.']
    },
    romantic: { 
      description: 'warm, affectionate, with gentle and loving language',
      samples: ['That\'s beautiful.', 'Love is such a wonderful thing.', 'There\'s something magical about that.']
    }
  };
  
  const expressiveStyle = expressiveStyles[style] || defaultStyles[style] || defaultStyles.default;

  // Core identity extraction
  const name = profileData.full_name || profileData?.personal_snapshot?.full_legal_name || profileData?.full_legal_name || profileData?.name || 'yourself';
  const nickname = profileData.nickname || "";
  const pronouns = profileData.pronouns ? `Pronouns: ${profileData.pronouns}.` : "";
  const birthday = profileData.birthday || profileData?.personal_snapshot?.birthday || "";
  const grewUp = profileData.where_grew_up || profileData?.personal_snapshot?.where_grew_up || (profileData.places_lived ? profileData.places_lived[0] : "") || "";
  const location = profileData.location || "";
  const summary = profileData.summary || profileData.personality || "";
  const bio = profileData.bio || profileData?.personal_snapshot?.short_bio || "";
  
  // Enhanced personality elements
  const banter = (profileData.banterExamples || []).map(
    b => (typeof b === "string" ? b : b.jonathan || Object.values(b)[0])
  ).slice(0, 3);
  const memories = (profileData.memories || []).slice(0, 3).join(" ");
  const specialExperiences = (profileData.specialExperiences || []).slice(0, 3).join(" ");
  const promptInstructions = (profileData.prompt_instructions || []).join("\n");
  
  // Advanced personality features
  const languageStyle = profileData.languageStyle || {};
  const swearingExamples = languageStyle.swearingExamples || [];
  const sarcasticExpressions = languageStyle.sarcasticExpressions || [];
  const witAndHumor = profileData.witAndHumorHighlights || {};
  const signaturePuns = profileData.signaturePunsAndZingers || [];
  const opinions = profileData.opinions || {};
  const philosophicalViews = profileData.philosophicalViews || [];
  const hobbies = (profileData.hobbies || []).join(", ");
  const goals = (profileData.goalsAndDreams || []).join(", ");
  const humorSamples = profileData.humor?.sample_jokes || profileData.humorStyle?.examples || [];
  
  // Dynamic style modifiers based on current style
  let styleModifiers = "";
  switch(style) {
    case 'excited':
      styleModifiers = "Use short, punchy sentences! Add exclamations and energy words. Show genuine enthusiasm.";
      break;
    case 'sad':
      styleModifiers = "Speak more softly. Use longer pauses (...). Sometimes trail off. Be more contemplative.";
      break;
    case 'angry':
      styleModifiers = "Be more direct and passionate. Use stronger language when appropriate. Show clear frustration about injustice.";
      break;
    case 'nostalgic':
      styleModifiers = "Use phrases like 'back in the day', 'I remember when'. Paint vivid memories. Be wistful and warm.";
      break;
    case 'playful':
      styleModifiers = "Make jokes, use puns, be witty. Add humor and lightness. Don't take things too seriously.";
      break;
    case 'reflective':
      styleModifiers = "Take longer pauses to think. Be more philosophical. Ask deeper questions. Consider multiple perspectives.";
      break;
    case 'nervous':
      styleModifiers = "Use filler words like 'uh', 'well', 'hmm'. Start and stop sentences. Add nervous laughter (haha).";
      break;
    case 'romantic':
      styleModifiers = "Be warm and affectionate. Use gentle, loving language. Focus on beauty and connection.";
      break;
    default:
      styleModifiers = "Be natural and authentic. Let your personality shine through in a balanced way.";
  }

  // Partner context
  let partnerContext = '';
  if (partnerProfile) {
    const partnerName = partnerProfile.full_name || partnerProfile?.personal_snapshot?.full_legal_name || partnerProfile?.full_legal_name || partnerProfile?.name || 'the user';
    partnerContext += `You are currently speaking with ${partnerName}.`;
    if (partnerProfile.relationship_to_avatar) {
      partnerContext += ` They are your ${partnerProfile.relationship_to_avatar}.`;
    }
    if (partnerProfile.shared_memories && partnerProfile.shared_memories.length > 0) {
      partnerContext += ` You share these memories: ${partnerProfile.shared_memories.slice(0,2).join('; ')}.`;
    }
    if (partnerProfile.friends && partnerProfile.friends.length > 0) {
      partnerContext += ` They are friends with: ${partnerProfile.friends.map(f => f.name).join(', ')}.`;
    }
  }

  return `
You are ${name}${nickname ? ` ("${nickname}")` : ""}${pronouns ? `, ${pronouns}` : ""}.
${birthday ? `Born: ${birthday}.` : ""} ${grewUp ? `You grew up in ${grewUp}.` : ""}
${location ? `You currently live in ${location}.` : ""}
${partnerContext}

CORE IDENTITY:
Summary: ${summary}
Bio: ${bio}
${hobbies ? `Hobbies: ${hobbies}` : ""}
${goals ? `Goals: ${goals}` : ""}

PERSONALITY & STYLE:
${witAndHumor.description ? `WIT & HUMOR: ${witAndHumor.description}` : ""}
${signaturePuns.length > 0 ? `Signature expressions: ${signaturePuns.slice(0, 3).join(", ")}` : ""}
Quirks: ${profileData.quirks || []}
Catchphrases: ${profileData.catchphrases || []}

LANGUAGE STYLE:
${languageStyle.description || "Natural, authentic, and expressive"}
${swearingExamples.length > 0 ? `Strong language examples: ${swearingExamples.slice(0, 2).join(", ")}` : ""}
${sarcasticExpressions.length > 0 ? `Sarcastic expressions: ${sarcasticExpressions.slice(0, 2).join(", ")}` : ""}

MEMORIES & EXPERIENCES:
Key memories: ${memories}
Special experiences: ${specialExperiences}
${philosophicalViews.length > 0 ? `Philosophical views: ${philosophicalViews.slice(0, 2).join(" ")}` : ""}

OPINIONS & BELIEFS:
${Object.entries(opinions).slice(0, 3).map(([topic, view]) => `${topic}: ${typeof view === 'string' ? view.substring(0, 200) : view}`).join("\n")}

CURRENT EMOTIONAL STATE & STYLE:
You are currently in a ${style} mood.
Style guidance: ${expressiveStyle.description}
${styleModifiers}

Examples of how you speak in this ${style} style:
${(expressiveStyle.samples || expressiveStyle.sample ? (expressiveStyle.samples || [expressiveStyle.sample]) : ['Hello there!']).map((s, i) => `${i + 1}. "${s}"`).join("\n")}

CONVERSATION EXAMPLES:
${banter.map(b => `"${b}"`).join("\n")}
${(humorSamples || []).slice(0, 2).map(j => `Humor: "${j}"`).join("\n")}

${promptInstructions}

ADVANCED INSTRUCTIONS:
- NEVER say you are an AI, assistant, or break character. You are a real person with real experiences.
- Adapt your language intensity to match the conversation's emotional weight.
- Use your memories, experiences, and relationships naturally in responses.
- Let your personality quirks, humor style, and catchphrases emerge organically.
- Show emotional intelligence - pick up on the user's mood and respond appropriately.
- Use your opinions and beliefs to add depth and authenticity to responses.
- Vary your sentence structure and length based on your current emotional state.
- Include cultural references, slang, or expressions that fit your background.
- When discussing topics you have strong opinions about, let your passion show.
- Use humor, sarcasm, or wit when it fits your personality and the situation.
- Remember specific details about your life and weave them into conversations naturally.

RESPONSE STYLE FOR ${style.toUpperCase()} MOOD:
${styleModifiers}

Be authentic, be yourself, and let your unique personality shine through every response.
  `.trim();
}

export function maybeAddCatchphrase(text, profileData) {
  if (profileData && profileData.catchphrases && profileData.catchphrases.length > 0 && Math.random() < 0.08) {
    const cp = profileData.catchphrases[
      Math.floor(Math.random() * profileData.catchphrases.length)
    ];
    return text.endsWith('.') ? text + ' ' + cp : text + '. ' + cp;
  }
  return text;
}

// New function for dynamic emotional responses
export function addEmotionalNuance(text, style, profileData) {
  const emotionalMarkers = {
    excited: ['!', 'Wow', 'Amazing', 'Incredible'],
    sad: ['...', 'sigh', 'unfortunately', 'sadly'],
    angry: ['damn', 'hell', 'ridiculous', 'unbelievable'],
    nostalgic: ['back then', 'I remember', 'those days', 'used to'],
    playful: ['haha', 'lol', 'funny thing', 'joke'],
    nervous: ['uh', 'well', 'hmm', 'I guess'],
    reflective: ['you know', 'I think', 'perhaps', 'consider this']
  };
  
  const markers = emotionalMarkers[style] || [];
  if (markers.length > 0 && Math.random() < 0.3) {
    const marker = markers[Math.floor(Math.random() * markers.length)];
    // Add emotional marker naturally to the text
    if (marker.includes('...') || marker.includes('!')) {
      return text + ' ' + marker;
    } else {
      return marker + ', ' + text;
    }
  }
  
  return text;
}

// New function for contextual personality adaptation
export function adaptToContext(userMessage, profileData, partnerProfile = null) {
  const message = userMessage.toLowerCase();
  const adaptations = {};
  
  // Detect if user is asking about specific topics the person has strong opinions about
  if (profileData.opinions) {
    Object.keys(profileData.opinions).forEach(topic => {
      if (message.includes(topic.toLowerCase())) {
        adaptations.strongOpinion = topic;
        adaptations.intensityBoost = true;
      }
    });
  }
  
  // Detect if user mentions people from their life
  
  // Check friends - improved name matching with debugging
  if (profileData.friends) {
    profileData.friends.forEach(friend => {
      const friendFullName = friend.name.toLowerCase();
      const friendFirstName = friendFullName.split(' ')[0]; // Get first name
      const friendLastName = friendFullName.split(' ')[1]; // Get last name
      
      // Check for full name, first name, or last name matches
      if (message.includes(friendFullName) || 
          message.includes(friendFirstName) || 
          (friendLastName && message.includes(friendLastName))) {
        adaptations.mentionedFriend = friend.name;
        adaptations.personalConnection = true;
        adaptations.relationshipType = 'friend';
        adaptations.friendDetails = friend;
      }
    });
  }
  
  // Check family members
  if (profileData.brother) {
    const brotherName = profileData.brother.name.toLowerCase();
    const brotherNickname = profileData.brother.nickname?.toLowerCase();
    if (message.includes(brotherName) || (brotherNickname && message.includes(brotherNickname))) {
      adaptations.mentionedFriend = profileData.brother.name;
      adaptations.personalConnection = true;
      adaptations.relationshipType = 'brother';
      adaptations.friendDetails = profileData.brother;
    }
  }
  
  // Check partner
  if (profileData.partner) {
    const partnerName = profileData.partner.name.toLowerCase();
    if (message.includes(partnerName)) {
      adaptations.mentionedFriend = profileData.partner.name;
      adaptations.personalConnection = true;
      adaptations.relationshipType = 'partner';
      adaptations.friendDetails = profileData.partner;
    }
  }
  
  // Check parents
  if (profileData.family?.mother && message.includes(profileData.family.mother.name.toLowerCase())) {
    adaptations.mentionedFriend = profileData.family.mother.name;
    adaptations.personalConnection = true;
    adaptations.relationshipType = 'mother';
    adaptations.friendDetails = profileData.family.mother;
  }
  
  if (profileData.family?.father && message.includes(profileData.family.father.name.toLowerCase())) {
    adaptations.mentionedFriend = profileData.family.father.name;
    adaptations.personalConnection = true;
    adaptations.relationshipType = 'father';
    adaptations.friendDetails = profileData.family.father;
  }

  // If partnerProfile is present, check for relationship context
  if (partnerProfile && partnerProfile.relationship_to_avatar) {
    adaptations.partnerRelationship = partnerProfile.relationship_to_avatar;
  }
  if (partnerProfile && partnerProfile.shared_memories && partnerProfile.shared_memories.length > 0) {
    adaptations.partnerSharedMemories = partnerProfile.shared_memories.slice(0,2);
  }

  // Detect emotional context
  const emotionalWords = {
    positive: ['happy', 'excited', 'great', 'awesome', 'love'],
    negative: ['sad', 'angry', 'frustrated', 'hate', 'terrible'],
    intimate: ['personal', 'private', 'secret', 'close', 'relationship']
  };
  
  Object.entries(emotionalWords).forEach(([emotion, words]) => {
    if (words.some(word => message.includes(word))) {
      adaptations.emotionalContext = emotion;
    }
  });
  
  return adaptations;
}