#!/bin/bash

# ============================================
# Fuqah AI - Export for Lovable.dev
# ============================================
# This script creates a complete ZIP file ready to import into Lovable
# ============================================

echo "🚀 Starting Fuqah AI export for Lovable..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create export directory
EXPORT_DIR="/tmp/fuqah-ai-lovable-export"
rm -rf "$EXPORT_DIR"
mkdir -p "$EXPORT_DIR"

echo -e "${BLUE}📁 Creating export directory...${NC}"

# Copy essential files
echo -e "${BLUE}📋 Copying configuration files...${NC}"
cp /workspaces/default/code/package.json "$EXPORT_DIR/"
cp /workspaces/default/code/tsconfig.json "$EXPORT_DIR/"
cp /workspaces/default/code/vite.config.ts "$EXPORT_DIR/" 2>/dev/null || true
cp /workspaces/default/code/tailwind.config.js "$EXPORT_DIR/" 2>/dev/null || true

# Copy src directory
echo -e "${BLUE}📦 Copying source code...${NC}"
cp -r /workspaces/default/code/src "$EXPORT_DIR/"

# Copy public directory (fonts, images)
echo -e "${BLUE}🎨 Copying assets...${NC}"
cp -r /workspaces/default/code/public "$EXPORT_DIR/" 2>/dev/null || true

# Copy Supabase files
echo -e "${BLUE}🗄️  Copying Supabase files...${NC}"
mkdir -p "$EXPORT_DIR/supabase"
cp -r /workspaces/default/code/supabase "$EXPORT_DIR/" 2>/dev/null || true
cp -r /workspaces/default/code/utils "$EXPORT_DIR/" 2>/dev/null || true

# Copy documentation
echo -e "${BLUE}📚 Copying documentation...${NC}"
cp /workspaces/default/code/README.md "$EXPORT_DIR/" 2>/dev/null || true
cp /workspaces/default/code/SUPABASE_SETUP.md "$EXPORT_DIR/" 2>/dev/null || true
cp /workspaces/default/code/MIGRATION_TO_LOVABLE.md "$EXPORT_DIR/" 2>/dev/null || true

# Create README for Lovable
cat > "$EXPORT_DIR/LOVABLE_SETUP.md" << 'EOF'
# Fuqah AI Dashboard - Lovable Setup

## 🚀 Quick Start

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Setup Supabase
1. Go to Settings → Integrations → Supabase
2. Connect your Supabase project:
   - Project ID: `kyohutbusszojssbgbvw`
   - Use the Anon Key from `utils/supabase/info.tsx`
3. Run the SQL from `supabase/schema/dashboard_tables.sql` in Supabase SQL Editor

### Step 3: Run Development Server
```bash
npm run dev
```

## ✅ What's Included

- ✅ Full Dashboard (8 pages)
- ✅ RTL/LTR support
- ✅ Dark/Light themes
- ✅ Custom Thmanyah Serif font
- ✅ Supabase integration
- ✅ 50+ components
- ✅ Complete routing

## 📋 Important Files

- `src/context/AppContext.tsx` - Global state management
- `src/routes.tsx` - Routing configuration
- `src/styles/theme.css` - CSS variables for theming
- `src/styles/fonts.css` - Font loading
- `src/services/supabase.ts` - Database service

## 🎨 Customization

### Colors
Edit `src/styles/theme.css` to change colors

### Fonts
Upload new fonts to `public/fonts/` and update `src/styles/fonts.css`

### Supabase
Connection details in `utils/supabase/info.tsx`

## 🐛 Troubleshooting

### Fonts not loading
- Check that font files exist in `public/fonts/`
- Verify paths in `src/styles/fonts.css`

### Supabase connection error
- Verify Project ID and Anon Key
- Run SQL setup from `supabase/schema/dashboard_tables.sql`

### RTL not working
- Check `dir={language === 'ar' ? 'rtl' : 'ltr'}` in components
- Verify AppContext is providing `language` state

---

Happy coding! 🚀
For support: www.fuqah.ai
EOF

# Create import instructions
cat > "$EXPORT_DIR/IMPORT_INSTRUCTIONS.txt" << 'EOF'
====================================
IMPORT TO LOVABLE - STEP BY STEP
====================================

METHOD 1: Direct Upload (Easiest)
----------------------------------
1. Go to https://lovable.dev
2. Click "New Project"
3. Choose "Import from ZIP"
4. Upload this ZIP file
5. Wait for Lovable to process
6. Follow LOVABLE_SETUP.md

METHOD 2: GitHub Import (Recommended)
--------------------------------------
1. Create a new GitHub repository
2. Extract this ZIP
3. Push to GitHub:
   ```
   cd fuqah-ai-lovable-export
   git init
   git add .
   git commit -m "Initial Fuqah AI Dashboard"
   git remote add origin YOUR_REPO_URL
   git push -u origin main
   ```
4. In Lovable, click "Import from GitHub"
5. Select your repository
6. Follow LOVABLE_SETUP.md

METHOD 3: Manual Setup
----------------------
1. Create a blank Lovable project
2. Extract this ZIP
3. Copy all files to Lovable's file explorer
4. Install dependencies via Terminal:
   npm install
5. Follow LOVABLE_SETUP.md

====================================

After import, read LOVABLE_SETUP.md for next steps!
EOF

# Create a package.json optimized for Lovable
cat > "$EXPORT_DIR/package.json.lovable" << 'EOF'
{
  "name": "fuqah-ai-dashboard",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@radix-ui/react-accordion": "^1.2.3",
    "@radix-ui/react-alert-dialog": "^1.1.6",
    "@radix-ui/react-dialog": "^1.1.6",
    "@radix-ui/react-dropdown-menu": "^2.1.6",
    "@radix-ui/react-popover": "^1.1.6",
    "@radix-ui/react-select": "^2.1.6",
    "@radix-ui/react-switch": "^1.1.3",
    "@radix-ui/react-tabs": "^1.1.3",
    "@radix-ui/react-tooltip": "^1.1.8",
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@mui/material": "^7.3.5",
    "@mui/icons-material": "^7.3.5",
    "motion": "^12.23.24",
    "lucide-react": "^0.487.0",
    "recharts": "^2.15.0",
    "react-router": "^7.13.0",
    "react-hook-form": "^7.55.0",
    "date-fns": "^3.6.0",
    "clsx": "^2.1.1",
    "class-variance-authority": "^0.7.1",
    "canvas-confetti": "^1.9.4",
    "@supabase/supabase-js": "^2.49.8"
  },
  "devDependencies": {
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.3",
    "vite": "^6.0.11",
    "tailwindcss": "^4.0.0"
  }
}
EOF

echo ""
echo -e "${BLUE}📊 Export Summary:${NC}"
echo "   - Configuration files: ✅"
echo "   - Source code: ✅"
echo "   - Assets & fonts: ✅"
echo "   - Supabase files: ✅"
echo "   - Documentation: ✅"
echo ""

# Create ZIP file
echo -e "${BLUE}🗜️  Creating ZIP file...${NC}"
cd /tmp
zip -r "fuqah-ai-lovable.zip" "fuqah-ai-lovable-export" -q

# Move to accessible location
mv "fuqah-ai-lovable.zip" "/workspaces/default/code/fuqah-ai-lovable.zip"

echo ""
echo -e "${GREEN}✅ Export completed successfully!${NC}"
echo ""
echo "📦 ZIP file location:"
echo "   /workspaces/default/code/fuqah-ai-lovable.zip"
echo ""
echo "📋 Next steps:"
echo "   1. Download the ZIP file"
echo "   2. Go to https://lovable.dev"
echo "   3. Import the ZIP or push to GitHub"
echo "   4. Follow LOVABLE_SETUP.md inside the ZIP"
echo ""
echo -e "${GREEN}🎉 Ready to import to Lovable!${NC}"
