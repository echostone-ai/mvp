import { NextRequest, NextResponse } from 'next/server';
import Ajv from 'ajv';

// Factbook validation schema
const factbookSchema = {
  type: 'object',
  patternProperties: {
    '^[a-zA-Z_]+$': {
      type: 'object',
      patternProperties: {
        '^[a-zA-Z_]+$': {
          type: 'object',
          required: ['id', 'text', 'topics', 'keywords'],
          properties: {
            id: {
              type: 'string',
              pattern: '^[a-zA-Z_]+\\.[a-zA-Z_]+$'
            },
            text: {
              type: 'string',
              maxLength: 400,
              minLength: 1
            },
            topics: {
              type: 'array',
              items: {
                type: 'string'
              },
              minItems: 1
            },
            keywords: {
              type: 'array',
              items: {
                type: 'string'
              },
              minItems: 1
            }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

const ajv = new Ajv();
const validate = ajv.compile(factbookSchema);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate JSON structure
    const isValid = validate(body);
    
    if (!isValid) {
      return NextResponse.json({
        valid: false,
        errors: validate.errors,
        message: 'Factbook structure validation failed'
      }, { status: 400 });
    }
    
    // Additional validation checks
    const validationResults = {
      valid: true,
      snippetCount: 0,
      sections: [] as string[],
      warnings: [] as string[],
      errors: [] as string[]
    };
    
    // Count snippets and check constraints
    for (const [sectionName, section] of Object.entries(body)) {
      validationResults.sections.push(sectionName);
      
      for (const [snippetName, snippet] of Object.entries(section as any)) {
        validationResults.snippetCount++;
        
        const snippetData = snippet as any;
        
        // Check ID format matches section.snippet pattern
        const expectedId = `${sectionName}.${snippetName}`;
        if (snippetData.id !== expectedId) {
          validationResults.errors.push(
            `Snippet ${snippetName} has incorrect ID. Expected: ${expectedId}, Got: ${snippetData.id}`
          );
        }
        
        // Check text length constraints
        if (snippetData.text.length > 400) {
          validationResults.errors.push(
            `Snippet ${snippetData.id} text exceeds 400 character limit (${snippetData.text.length} chars)`
          );
        }
        
        // Check for empty topics or keywords
        if (snippetData.topics.length === 0) {
          validationResults.errors.push(`Snippet ${snippetData.id} has no topics`);
        }
        
        if (snippetData.keywords.length === 0) {
          validationResults.errors.push(`Snippet ${snippetData.id} has no keywords`);
        }
        
        // Warning for very short text
        if (snippetData.text.length < 20) {
          validationResults.warnings.push(
            `Snippet ${snippetData.id} has very short text (${snippetData.text.length} chars)`
          );
        }
        
        // Warning for too many keywords
        if (snippetData.keywords.length > 10) {
          validationResults.warnings.push(
            `Snippet ${snippetData.id} has many keywords (${snippetData.keywords.length}), consider reducing`
          );
        }
      }
    }
    
    // Set valid to false if there are errors
    if (validationResults.errors.length > 0) {
      validationResults.valid = false;
    }
    
    return NextResponse.json(validationResults);
    
  } catch (error) {
    return NextResponse.json({
      valid: false,
      message: 'Invalid JSON or server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Factbook validation endpoint',
    usage: 'POST JSON factbook structure to validate',
    schema: factbookSchema
  });
}