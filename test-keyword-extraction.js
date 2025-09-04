const query = 'Tell me about Olive';
const words = query.toLowerCase()
  .replace(/[^\w\s]/g, ' ')
  .split(/\s+/)
  .filter(word => word.length > 2 && !['what', 'when', 'where', 'how', 'why', 'did', 'you', 'your', 'the', 'and', 'but', 'for', 'are', 'with', 'this', 'that', 'they', 'have', 'from', 'been', 'were', 'said', 'each', 'which', 'their', 'time', 'will', 'about', 'would', 'there', 'could', 'other', 'after', 'first', 'well', 'many', 'some', 'these', 'may', 'then', 'them', 'people', 'into', 'very', 'know', 'just', 'like', 'over', 'think', 'also', 'back', 'work', 'life', 'only', 'can', 'should', 'any', 'new', 'way', 'look', 'good', 'want', 'through', 'much', 'before', 'right', 'too', 'means', 'old', 'take', 'than', 'high', 'never', 'more', 'used', 'make', 'most', 'over', 'such', 'during', 'here', 'even', 'off', 'used', 'against', 'because', 'does', 'part', 'being', 'now', 'made', 'before', 'here', 'through', 'when', 'where', 'much', 'should', 'well', 'without', 'may', 'use', 'your', 'way', 'about', 'many', 'then', 'them', 'these'].includes(word));

console.log('Extracted keywords:', words);
console.log('Keywords length:', words.length);