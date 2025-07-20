const fs = require('fs');
const path = require('path');

// List of files to update
const routeFiles = [
  {
    path: 'src/app/api/hubs/[hubId]/invitations/route.ts',
    params: { hubId: 'string' }
  },
  {
    path: 'src/app/api/hubs/[hubId]/memories/[memoryId]/flag/route.ts',
    params: { hubId: 'string', memoryId: 'string' }
  },
  {
    path: 'src/app/api/hubs/[hubId]/memories/[memoryId]/route.ts',
    params: { hubId: 'string', memoryId: 'string' }
  },
  {
    path: 'src/app/api/hubs/[hubId]/memories/route.ts',
    params: { hubId: 'string' }
  },
  {
    path: 'src/app/api/hubs/[hubId]/route.ts',
    params: { hubId: 'string' }
  },
  {
    path: 'src/app/api/hubs/route.ts',
    params: {}
  },
  {
    path: 'src/app/api/invitations/[token]/accept/route.ts',
    params: { token: 'string' }
  },
  {
    path: 'src/app/api/invitations/[token]/validate/route.ts',
    params: { token: 'string' }
  }
];

// Function to update a route file
function updateRouteFile(filePath, params) {
  try {
    // Read the file
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Create the params type definition
    let paramsTypeDefinition = '';
    if (Object.keys(params).length > 0) {
      const paramsString = Object.entries(params)
        .map(([key, type]) => `    ${key}: ${type};`)
        .join('\n');
      
      paramsTypeDefinition = `
// Define the params type
type RouteParams = {
  params: {
${paramsString}
  }
};
`;
    }
    
    // Update the route handler signatures
    let updatedContent = content;
    
    // Replace GET handler
    updatedContent = updatedContent.replace(
      /export\s+async\s+function\s+GET\s*\(\s*request\s*:\s*NextRequest\s*,\s*[^)]*\)/g,
      Object.keys(params).length > 0
        ? `export async function GET(request: NextRequest, { params }: RouteParams)`
        : `export async function GET(request: NextRequest)`
    );
    
    // Replace POST handler
    updatedContent = updatedContent.replace(
      /export\s+async\s+function\s+POST\s*\(\s*request\s*:\s*NextRequest\s*,\s*[^)]*\)/g,
      Object.keys(params).length > 0
        ? `export async function POST(request: NextRequest, { params }: RouteParams)`
        : `export async function POST(request: NextRequest)`
    );
    
    // Replace PUT handler
    updatedContent = updatedContent.replace(
      /export\s+async\s+function\s+PUT\s*\(\s*request\s*:\s*NextRequest\s*,\s*[^)]*\)/g,
      Object.keys(params).length > 0
        ? `export async function PUT(request: NextRequest, { params }: RouteParams)`
        : `export async function PUT(request: NextRequest)`
    );
    
    // Replace DELETE handler
    updatedContent = updatedContent.replace(
      /export\s+async\s+function\s+DELETE\s*\(\s*request\s*:\s*NextRequest\s*,\s*[^)]*\)/g,
      Object.keys(params).length > 0
        ? `export async function DELETE(request: NextRequest, { params }: RouteParams)`
        : `export async function DELETE(request: NextRequest)`
    );
    
    // Insert the params type definition after the imports
    if (paramsTypeDefinition) {
      const lastImportIndex = updatedContent.lastIndexOf('import');
      const lastImportLineEnd = updatedContent.indexOf(';', lastImportIndex) + 1;
      
      updatedContent = 
        updatedContent.substring(0, lastImportLineEnd) + 
        '\n' + 
        paramsTypeDefinition + 
        updatedContent.substring(lastImportLineEnd);
    }
    
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
routeFiles.forEach(file => {
  updateRouteFile(file.path, file.params);
});

console.log('All route files updated successfully!');