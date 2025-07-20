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

// Function to update imports in a file
function updateImports(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Replace the import
    const updatedContent = content.replace(
      /import\s*{\s*getServerSession\s*}\s*from\s*['"]next-auth\/next['"]/g,
      "import { getServerSession } from 'next-auth'"
    );
    
    // Write the updated content back to the file
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    
    console.log(`Updated imports in ${filePath}`);
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error);
  }
}

// Update all files
filesToUpdate.forEach(updateImports);

console.log('All imports updated successfully!');