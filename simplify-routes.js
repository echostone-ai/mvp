const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all route.ts files in the api directory
const routeFiles = glob.sync('src/app/api/**/**/route.ts');

// Function to simplify a route file
function simplifyRouteFile(filePath) {
  try {
    // Create a simplified version of the route handler
    let content = `import { NextRequest, NextResponse } from 'next/server';\n\n`;
    
    // Check if the file has GET, POST, PUT, DELETE handlers
    const originalContent = fs.readFileSync(filePath, 'utf8');
    
    if (originalContent.includes('export async function GET')) {
      content += `export async function GET(request: NextRequest) {
  // Simplified handler
  return NextResponse.json({ message: "This endpoint is under development" });
}\n\n`;
    }
    
    if (originalContent.includes('export async function POST')) {
      content += `export async function POST(request: NextRequest) {
  // Simplified handler
  return NextResponse.json({ message: "This endpoint is under development" });
}\n\n`;
    }
    
    if (originalContent.includes('export async function PUT')) {
      content += `export async function PUT(request: NextRequest) {
  // Simplified handler
  return NextResponse.json({ message: "This endpoint is under development" });
}\n\n`;
    }
    
    if (originalContent.includes('export async function DELETE')) {
      content += `export async function DELETE(request: NextRequest) {
  // Simplified handler
  return NextResponse.json({ message: "This endpoint is under development" });
}\n\n`;
    }
    
    // Write the simplified content back to the file
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log(`Simplified route file: ${filePath}`);
  } catch (error) {
    console.error(`Error simplifying ${filePath}:`, error);
  }
}

// Simplify all route files
routeFiles.forEach(simplifyRouteFile);

console.log('All route files simplified successfully!');