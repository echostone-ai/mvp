const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all route.ts files in the api directory
const routeFiles = glob.sync('src/app/api/**/**/route.ts');

// Function to update a route file
function updateRouteFile(filePath) {
  try {
    // Read the file
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Extract the directory path to determine the parameters
    const dirPath = path.dirname(filePath);
    const segments = dirPath.split('/');
    
    // Extract dynamic route parameters
    const params = {};
    segments.forEach(segment => {
      if (segment.startsWith('[') && segment.endsWith(']')) {
        const paramName = segment.slice(1, -1);
        params[paramName] = 'string';
      }
    });
    
    // Create the params object string
    let paramsString = '';
    if (Object.keys(params).length > 0) {
      paramsString = `{ params: { ${Object.entries(params).map(([key, type]) => `${key}: ${type}`).join(', ')} } }`;
    }
    
    // Update the route handler signatures
    let updatedContent = content;
    
    // Replace GET handler
    if (updatedContent.includes('export async function GET')) {
      updatedContent = updatedContent.replace(
        /export\s+async\s+function\s+GET\s*\(\s*request\s*:\s*NextRequest[^)]*\)/g,
        Object.keys(params).length > 0
          ? `export async function GET(request: NextRequest, { params }: ${paramsString})`
          : `export async function GET(request: NextRequest)`
      );
    }
    
    // Replace POST handler
    if (updatedContent.includes('export async function POST')) {
      updatedContent = updatedContent.replace(
        /export\s+async\s+function\s+POST\s*\(\s*request\s*:\s*NextRequest[^)]*\)/g,
        Object.keys(params).length > 0
          ? `export async function POST(request: NextRequest, { params }: ${paramsString})`
          : `export async function POST(request: NextRequest)`
      );
    }
    
    // Replace PUT handler
    if (updatedContent.includes('export async function PUT')) {
      updatedContent = updatedContent.replace(
        /export\s+async\s+function\s+PUT\s*\(\s*request\s*:\s*NextRequest[^)]*\)/g,
        Object.keys(params).length > 0
          ? `export async function PUT(request: NextRequest, { params }: ${paramsString})`
          : `export async function PUT(request: NextRequest)`
      );
    }
    
    // Replace DELETE handler
    if (updatedContent.includes('export async function DELETE')) {
      updatedContent = updatedContent.replace(
        /export\s+async\s+function\s+DELETE\s*\(\s*request\s*:\s*NextRequest[^)]*\)/g,
        Object.keys(params).length > 0
          ? `export async function DELETE(request: NextRequest, { params }: ${paramsString})`
          : `export async function DELETE(request: NextRequest)`
      );
    }
    
    // Remove any type definitions for RouteParams
    updatedContent = updatedContent.replace(/\/\/\s*Define the params type[\s\S]*?}\s*;/g, '');
    
    // Fix any references to context.params
    updatedContent = updatedContent.replace(/context\.params/g, 'params');
    
    // Write the updated content back to the file
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    
    console.log(`Updated route file: ${filePath}`);
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error);
  }
}

// Update all route files
routeFiles.forEach(updateRouteFile);

console.log('All route files updated successfully!');