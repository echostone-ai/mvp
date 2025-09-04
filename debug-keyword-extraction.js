// Debug the keyword extraction
function extractKeywords(text) {
  const stopWords = new Set(['what', 'was', 'your', 'the', 'a', 'an', 'is', 'are', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'and', 'or', 'but', 'so', 'if', 'then', 'else', 'when', 'where', 'why', 'how', 'who', 'which', 'that', 'this', 'these', 'those', 'me', 'my', 'mine', 'you', 'yours', 'he', 'his', 'she', 'her', 'hers', 'it', 'its', 'we', 'our', 'ours', 'they', 'their', 'theirs', 'i', 'tell', 'about']);
  const importantWords = new Set(['dog', 'cat', 'pet', 'music', 'band', 'song', 'name', 'age', 'job', 'work', 'live', 'born', 'from']);
  
  const words = text.toLowerCase().split(/\s+/);
  console.log('All words:', words);
  
  const filtered = words.filter(word => {
    const lengthCheck = word.length >= 3;
    const stopWordCheck = !stopWords.has(word);
    const regexCheck = /^[a-z]+$/.test(word);
    const importantCheck = importantWords.has(word);
    
    const passes = (lengthCheck && stopWordCheck && regexCheck) || importantCheck;
    
    console.log(`"${word}": length=${word.length} (${lengthCheck}), stopWord=${!stopWordCheck} (${stopWordCheck}), regex=${regexCheck}, important=${importantCheck} => ${passes}`);
    
    return passes;
  });
  
  return filtered;
}

console.log('🔍 Debugging keyword extraction for "What was your first dog?":\n');

const result = extractKeywords('What was your first dog?');
console.log('\nFinal keywords:', result);