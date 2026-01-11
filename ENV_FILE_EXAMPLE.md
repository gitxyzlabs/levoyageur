# Environment Variables Setup

## File Location

The `.env.local` file should be placed in the **root directory** of your project:

```
le-voyageur/
├── .env.local          ← PUT IT HERE!
├── package.json
├── vite.config.ts
├── index.html
├── src/
├── supabase/
└── ...
```

## File Contents

Your `.env.local` file should look exactly like this:

```env
VITE_GOOGLE_MAPS_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### ⚠️ Important Notes:

1. **No spaces** around the equals sign
2. **No quotes** around the API key
3. The variable name **must** start with `VITE_` (Vite requirement)
4. Replace `AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` with your actual key

## Example with Real Format

```env
# Good ✅
VITE_GOOGLE_MAPS_API_KEY=AIzaSyDGH7k8Jm9P3xYz1AbCdEfGhIjKlMnOpQr

# Bad ❌ - Has quotes
VITE_GOOGLE_MAPS_API_KEY="AIzaSyDGH7k8Jm9P3xYz1AbCdEfGhIjKlMnOpQr"

# Bad ❌ - Has spaces
VITE_GOOGLE_MAPS_API_KEY = AIzaSyDGH7k8Jm9P3xYz1AbCdEfGhIjKlMnOpQr

# Bad ❌ - Missing VITE_ prefix
GOOGLE_MAPS_API_KEY=AIzaSyDGH7k8Jm9P3xYz1AbCdEfGhIjKlMnOpQr
```

## How to Create the File

### On macOS/Linux:
```bash
# Navigate to project root
cd le-voyageur

# Create the file
touch .env.local

# Edit with your favorite editor
nano .env.local
# or
code .env.local
```

### On Windows:
```bash
# Navigate to project root
cd le-voyageur

# Create the file
type nul > .env.local

# Edit with notepad
notepad .env.local
```

### Or Just Use Your IDE:
1. Open your project in VS Code (or any editor)
2. Right-click in the file explorer
3. Select "New File"
4. Name it `.env.local`
5. Add the contents above

## Verification

After creating the file, verify it exists:

```bash
# macOS/Linux
ls -la | grep .env

# Windows
dir .env*
```

You should see `.env.local` in the output.

## For Different Environments

### Local Development
Use `.env.local` with `VITE_GOOGLE_MAPS_API_KEY`

### Vercel Deployment
Add `VITE_GOOGLE_MAPS_API_KEY` in:
- Vercel Dashboard → Your Project → Settings → Environment Variables

### Figma Make / Supabase
Already configured! The app uses `GOOGLE_MAPS_API_KEY` from Supabase secrets (no VITE_ prefix).

## Security

⚠️ **NEVER commit `.env.local` to Git!**

The `.gitignore` file is already configured to exclude it:
```
.env.local
```

If you accidentally committed it:
1. Remove it from git: `git rm --cached .env.local`
2. Rotate your API key in Google Cloud Console
3. Add the new key to `.env.local`

---

Questions? See [GOOGLE_MAPS_SETUP.md](./GOOGLE_MAPS_SETUP.md) for more details.
