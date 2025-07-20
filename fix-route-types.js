const fs = require('fs');
const path = require('path');

// List of files to update
const filesToUpdate = [
  'src/app/api/hubs/[hubId]/flags/[flagId]/resolve/route.ts',
  'src/app/api/hubs/[hubId]/flags/route.ts',
  'src/app/api/hubs/[hubId]/invitations/route.ts',
  'src/app/api/hubs/[hubId]/memories/[memoryId]/flag/route.ts',
  'src/app/api/hubs/[hubId]/memories/[memoryId]/route.ts',
  'src/app/api/hubs/[hubId]/memories/route.ts',
  'src/app/api/hubs/[hubId]/route.ts',
  'src/app/api/hubs/route.ts',
  'src/app/api/invitations/[token]/accept/route.ts',
  'src/app/api/upload/route.ts'
];

// Function to update route handler types in a file
function updateRouteTypes(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Replace the route handler type signature
    let updatedContent = content;
    
    // Match export async function POST/GET/PUT/DELETE with params
    const routeHandlerRegex = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(\s*request\s*:\s*NextRequest\s*,\s*{\s*params\s*}\s*:\s*{\s*params\s*:\s*{[^}]*}\s*}\s*\)/g;
    
    updatedContent = updatedContent.replace(routeHandlerRegex, (match, method) => {
      // Extract the params type from the match
      const paramsTypeMatch = match.match(/{\s*params\s*:\s*({[^}]*})\s*}/);
      if (!paramsTypeMatch) return match;
      
      const paramsType = paramsTypeMatch[1];
      
      // Create the new signature
      return `export async function ${method}(
  request: NextRequest,
  context: { params: ${paramsType} }
)`;
    });
    
    // Write the updated content back to the file
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    
    console.log(`Updated route handler types in ${filePath}`);
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error);
  }
}

// Update all files
filesToUpdate.forEach(updateRouteTypes);

console.log('All route handler types updated successfully!');