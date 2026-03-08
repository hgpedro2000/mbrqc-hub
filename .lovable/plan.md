

## Plan: Replace Login Icon with Hyundai Mobis Logo

The user wants to replace the `ClipboardCheck` icon on the Login page (line 48) with the uploaded Hyundai Mobis logo image.

### Changes

1. **Copy the logo** from `user-uploads://Hyundai_Mobis-Logo.wine.png` to `src/assets/hyundai-mobis-logo.png`

2. **Edit `src/pages/Login.tsx`**:
   - Remove the `ClipboardCheck` import from lucide-react
   - Add `import logo from "@/assets/hyundai-mobis-logo.png"`
   - Replace the icon container div (the rounded box with ClipboardCheck) with an `<img>` tag displaying the logo (~120px wide, centered)

