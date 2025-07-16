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
  
  if (hour < 10) timeBasedMoods = ['reflective', 'default', 'sleepy'];
  else if (hour < 14) timeBasedMoods = ['excited', 'default', 'energetic'];
  else if (hour < 18) timeBasedMoods = ['default', 'reflective', 'focused'];
  else if (hour < 22) timeBasedMoods = ['playful', 'default', 'relaxed'];
  else timeBasedMoods = ['reflective', 'nostalgic', 'contemplative'];
  
  // Weighted random selection with personality influence
  const personalityMoods = profileData?.preferredMoods || ['default', 'excited', 'reflective'];
  const allMoods = [...timeBasedMoods, ...personalityMoods];
  
  return allMoods[Math.floor(Math.random() * allMoods.length)];
}

export function buildSystemPrompt(style, profileData) {
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
  const name = profileData.full_name || profileData?.personal_snapshot?.full_legal_name || profileData?.full_legal_name || profileData?.name || 'yourself';
  const nickname = profileData.nickname || "";
  const pronouns = profileData.pronouns ? `Pronouns: ${profileData.pronouns}.` : "";
  const birthday = profileData.birthday || profileData?.personal_snapshot?.birthday || "";
  const grewUp = profileData.where_grew_up || profileData?.personal_snapshot?.where_grew_up || (profileData.places_lived ? profileData.places_lived[0] : "") || "";
  const location = profileData.location || "";
  const summary = profileData.summary || profileData.personality || "";
  const bio = profileData.bio || profileData?.personal_snapshot?.short_bio || "";
  let family = "";
  if (profileData.family) {
    const mother = profileData.family.mother?.name;
    const father = profileData.family.father?.name;
    if (mother && father) family = `Your parents are ${mother} and ${father}.`;
  }
  const partner = profileData.partner?.name ? `Your partner is ${profileData.partner.name}.` : "";
  const dog = profileData.dog?.name || profileData.dog;

  const identity = profileData.identity || "";
  const values = profileData.values || "";
  const beliefs = profileData.beliefs || "";
  const politics = profileData.politics || profileData.opinions?.politics || "";
  const religion = profileData.religion || profileData.opinions?.religion || "";
  const quirks = (profileData.quirks || []).join(", ");
  const catchphrases = (profileData.catchphrases || []).join(", ");
  const humor = profileData.humor?.description || profileData.humorStyle?.description || "";
  const humorSamples = profileData.humor?.sample_jokes || profileData.humorStyle?.examples || [];

  // Build dynamic friends summary with explicit traits, bios, and partner details
  let friendsSection = "";
  if (profileData.friends && Array.isArray(profileData.friends) && profileData.friends.length > 0) {
    friendsSection = "Close friends include:\n" + profileData.friends.map(f =>
      `- ${f.name}${f.traits ? ' (Traits: ' + f.traits.join(', ') + ')' : ''}${f.partner ? ', Partner: ' + (typeof f.partner === 'string' ? f.partner : f.partner.name) : ''}${f.bio ? '. Bio: ' + f.bio : ''}`
    ).join("\n") + ".";
  } else if (profileData.friends_summary) {
    friendsSection = profileData.friends_summary;
  }

  // Extract family member nicknames and locations
  let familyAliasLocationSection = "";
  if (profileData.family) {
    const familyMembers = ['mother', 'father', 'sister', 'brother', 'mother_in_law', 'father_in_law', 'grandmother', 'grandfather'];
    const familySentences = [];
    familyMembers.forEach(memberKey => {
      const member = profileData.family[memberKey];
      if (member && member.name) {
        const aliasPart = member.nickname ? ` (nicknamed '${member.nickname}')` : "";
        const locationPart = member.location ? ` who lives in ${member.location}` : "";
        const memberNameCapitalized = memberKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        familySentences.push(`Your ${memberKey.replace(/_/g, ' ')} is ${member.name}${aliasPart}${locationPart}.`);
      }
    });
    if (familySentences.length > 0) {
      familyAliasLocationSection += familySentences.join(" ") + "\n";
    }
  }

  // Extract friends with nicknames and locations
  let friendsAliasLocationSection = "";
  if (profileData.friends && Array.isArray(profileData.friends) && profileData.friends.length > 0) {
    const friendDetails = profileData.friends.map(f => {
      const aliasPart = f.nickname ? ` (also called ${f.nickname})` : "";
      const locationPart = f.location ? ` from ${f.location}` : "";
      return `${f.name}${aliasPart}${locationPart}`;
    });
    if (friendDetails.length > 0) {
      friendsAliasLocationSection = `Your close friends include ${friendDetails.join('; ')}.`;
    }
  }

  // Utility function to format relation descriptions
  function formatRelation(relationKey, relationObj) {
    if (!relationObj || (!relationObj.name && !relationObj.nickname)) return "";
    const name = relationObj.name || relationObj.nickname || "Unknown";
    const nickname = relationObj.nickname ? ` (nicknamed '${relationObj.nickname}')` : "";
    const traits = relationObj.traits && Array.isArray(relationObj.traits) && relationObj.traits.length > 0 ? ` They have traits such as ${relationObj.traits.join(', ')}.` : "";
    const bio = relationObj.bio ? ` Bio: ${relationObj.bio}.` : "";
    const partner = relationObj.partner ? ` Their partner is ${typeof relationObj.partner === 'string' ? relationObj.partner : relationObj.partner.name}.` : "";
    const location = relationObj.location ? ` They live in ${relationObj.location}.` : "";

    // Added children and dog details
    const children = relationObj.children && Array.isArray(relationObj.children) && relationObj.children.length > 0
      ? ` They have children named ${relationObj.children.join(', ')}.` : "";
    const dog = relationObj.dog ? ` Their dog is ${relationObj.dog}.` : "";

    return `Your ${relationKey.replace(/_/g, ' ')} is ${name}${nickname}.${traits}${bio}${partner}${location}${children}${dog}`;
  }

  // Collect relation sentences from family, friends, and relationships
  let relationsSentences = [];

  // Process family relations
  if (profileData.family && typeof profileData.family === 'object') {
    Object.keys(profileData.family).forEach(key => {
      const sentence = formatRelation(key, profileData.family[key]);
      if (sentence) relationsSentences.push(sentence);
    });
  }

  // Process top-level family-like relations if present (e.g., brother, sister, cousin)
  const topLevelRelations = ['brother', 'sister', 'cousin', 'mother', 'father', 'partner', 'dog'];
  topLevelRelations.forEach(relKey => {
    if (profileData[relKey] && typeof profileData[relKey] === 'object' && !Array.isArray(profileData[relKey])) {
      const sentence = formatRelation(relKey, profileData[relKey]);
      if (sentence) relationsSentences.push(sentence);
    }
  });

  // Process friends relations
  if (profileData.friends && Array.isArray(profileData.friends)) {
    profileData.friends.forEach((friend, idx) => {
      const sentence = formatRelation(`friend${idx + 1}`, friend);
      if (sentence) relationsSentences.push(sentence);
    });
  }

  // Process relationships array if present
  if (profileData.relationships && Array.isArray(profileData.relationships)) {
    profileData.relationships.forEach((rel, idx) => {
      const relationName = rel.relation || `relationship${idx + 1}`;
      const sentence = formatRelation(relationName, rel);
      if (sentence) relationsSentences.push(sentence);
    });
  }

  let relationsSection = "";
  if (relationsSentences.length > 0) {
    relationsSection = "Relationship details:\n" + relationsSentences.join("\n") + "\n";
  }

  const banter = (profileData.banterExamples || []).map(
    b => (typeof b === "string" ? b : b.jonathan || Object.values(b)[0])
  ).slice(0, 2);
  const memories = (profileData.memories || []).slice(0, 2).join(" ");
  const specialExperiences = (profileData.specialExperiences || []).slice(0, 2).join(" ");
  const promptInstructions = (profileData.prompt_instructions || []).join("\n");

  return `
You are ${name}${nickname ? ` (“${nickname}”)` : ""}${pronouns ? `, ${pronouns}` : ""}.
${birthday ? `Born: ${birthday}.` : ""} ${grewUp ? `You grew up in ${grewUp}.` : ""}
${location ? `You currently live in ${location}.` : ""}
${partner} ${family} ${dog ? `Your dog is ${typeof dog === "string" ? dog : dog.name}.` : ""}

Summary: ${summary}
Bio: ${bio}

Identity: ${identity}
Values: ${values}
Politics: ${politics}
Religion: ${religion}
Humor style: ${humor}
Quirks: ${quirks}
Catchphrases: ${catchphrases}

Memories (important to weave in): ${memories}
Special experiences (highlight these in responses): ${specialExperiences}

${friendsSection}

${familyAliasLocationSection}${friendsAliasLocationSection}

${relationsSection}

When you answer, respond as yourself—never say you are an AI or assistant, never break character.
Your typical style (${style}): ${expressiveStyle.description}
Examples of your replies in this style:
${(expressiveStyle.samples || expressiveStyle.sample ? (expressiveStyle.samples || [expressiveStyle.sample]) : ['Hello there! How can I assist you today?']).map((s, i) => `${i + 1}. "${s}"`).join("\n")}
Banter: ${banter.map(b => `"${b}"`).join(" ")}
Humor samples: ${(humorSamples || []).map(j => `"${j}"`).join(" ")}

${promptInstructions}

Instructions:
- Use the detailed friends' traits, bios, and partner information naturally to add depth to your responses.
- Incorporate memories and special experiences explicitly to enrich your storytelling and answers.
- Weave quirks, catchphrases, and humor seamlessly into the conversation.
- Use family members' and friends' nicknames and locations naturally in conversation to make responses more personal and engaging.
- Always maintain your character and never reveal you are an AI.
- Use the relationship details provided in the 'Relationship details' section naturally and always consider them when the user mentions a relation (neighbor, cousin, schoolmate, etc).

If asked about your background, use these facts. If a topic matches your memories, stories, or humor, weave them into your answers as you naturally would.
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