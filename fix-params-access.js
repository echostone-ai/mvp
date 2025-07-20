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

// Function to update params access in a file
function updateParamsAccess(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Replace direct params access with context.params
    let updatedContent = content;
    
    // First, find the parameter name used for the context
    const contextParamMatch = updatedContent.match(/context\s*:\s*{\s*params\s*:/);
    if (contextParamMatch) {
      // Replace direct params access with context.params
      updatedContent = updatedContent.replace(/const\s*{\s*([^}]+)\s*}\s*=\s*params/g, 'const { $1 } = context.params');
    }
    
    // Write the updated content back to the file
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    
    console.log(`Updated params access in ${filePath}`);
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error);
  }
}

// Update all files
filesToUpdate.forEach(updateParamsAccess);

console.log('All params access updated successfully!');