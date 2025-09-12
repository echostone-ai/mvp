import { describe, it, expect } from 'vitest';
import { POST, GET } from '../route';
import { NextRequest } from 'next/server';

describe('/api/factbook/validate', () => {
  it('should validate correct factbook structure', async () => {
    const validFactbook = {
      "pets": {
        "olive": {
          "id": "pets.olive",
          "text": "Olive was my beloved Puerto Rican street dog.",
          "topics": ["pets", "dogs"],
          "keywords": ["olive", "dog", "puerto", "rican"]
        }
      }
    };

    const request = new NextRequest('http://localhost:3000/api/factbook/validate', {
      method: 'POST',
      body: JSON.stringify(validFactbook),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.snippetCount).toBe(1);
    expect(data.sections).toContain('pets');
  });

  it('should reject factbook with text too long', async () => {
    const invalidFactbook = {
      "pets": {
        "olive": {
          "id": "pets.olive",
          "text": "A".repeat(401), // Exceeds 400 char limit
          "topics": ["pets"],
          "keywords": ["olive"]
        }
      }
    };

    const request = new NextRequest('http://localhost:3000/api/factbook/validate', {
      method: 'POST',
      body: JSON.stringify(invalidFactbook),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.valid).toBe(false);
    expect(data.errors).toBeDefined();
  });

  it('should reject factbook with incorrect ID format', async () => {
    const invalidFactbook = {
      "pets": {
        "olive": {
          "id": "wrong.format.here",
          "text": "Olive was my dog.",
          "topics": ["pets"],
          "keywords": ["olive"]
        }
      }
    };

    const request = new NextRequest('http://localhost:3000/api/factbook/validate', {
      method: 'POST',
      body: JSON.stringify(invalidFactbook),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.valid).toBe(false);
    // Check that we have validation errors (could be from AJV or our custom validation)
    expect(data.errors.length).toBeGreaterThan(0);
  });

  it('should return schema info on GET request', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Factbook validation endpoint');
    expect(data.schema).toBeDefined();
  });

  it('should validate minimal factbook successfully', async () => {
    const minimalFactbook = {
      "timeline": {
        "austin_years": {
          "id": "timeline.austin_years",
          "text": "I lived in Austin, Texas from 2009 to 2018 - nine incredible years.",
          "topics": ["timeline", "places", "austin"],
          "keywords": ["austin", "texas", "2009", "2018", "nine", "years"]
        }
      },
      "relationships": {
        "tyler": {
          "id": "relationships.tyler",
          "text": "Tyler is one of my closest friends from Austin.",
          "topics": ["relationships", "friends", "austin"],
          "keywords": ["tyler", "friend", "austin", "smart", "humor"]
        }
      },
      "pets": {
        "olive": {
          "id": "pets.olive",
          "text": "Olive was my beloved Puerto Rican street dog.",
          "topics": ["pets", "dogs", "olive"],
          "keywords": ["olive", "puerto", "rican", "street", "dog"]
        }
      }
    };

    const request = new NextRequest('http://localhost:3000/api/factbook/validate', {
      method: 'POST',
      body: JSON.stringify(minimalFactbook),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.snippetCount).toBe(3);
    expect(data.sections).toEqual(['timeline', 'relationships', 'pets']);
  });
});