# GitHub Token Setup for ExampleServer Launcher

This guide will help you create a GitHub Personal Access Token to use with the Admin Panel for managing mods.

## Step 1: Create Your Token

1. **Go to GitHub Token Settings:**
   - Visit: https://github.com/settings/personal-access-tokens/new
   - Make sure you're logged into your GitHub account

2. **Configure Token Settings:**
   - **Token name:** `launcher-template-admin`
   - **Expiration:** Choose "No expiration" or "1 year"
   - **Description:** (Optional) "Admin panel for launcher template"

3. **Repository Access:**
   - Select: **"Only select repositories"**
   - Click the dropdown and select: `kiroku67/launcher-template`

4. **Permissions:**
   Under "Repository permissions", set:
   - **Contents:** Read and write ✅
   - **Workflows:** Read ✅
   
5. **Generate Token:**
   - Click **"Generate token"** at the bottom
   - **IMPORTANT:** Copy the token immediately! You won't be able to see it again.

## Step 2: Use the Token in Admin Panel

1. Download and open the Admin Panel application
2. On first launch, you'll see a token input field
3. Paste your GitHub token
4. Click "Login"
5. You're ready to manage mods!

## Managing Mods

### Upload a Mod:
1. Click "Choose File" and select your .jar mod file
2. Select mod type:
   - **Required:** Always installed, players can't disable
   - **Optional (Enabled):** Installed by default, players can disable
   - **Optional (Disabled):** Not installed by default, players can enable
3. Click "Upload"
4. Wait 2-3 minutes for changes to take effect

### Delete a Mod:
1. Find the mod in the list
2. Click "Delete" next to it
3. Confirm deletion
4. Wait 2-3 minutes for changes to take effect

## How It Works

When you upload or delete a mod:
1. File is added/removed from GitHub repository
2. GitHub Actions automatically runs (takes ~2-3 minutes)
3. Distribution.json is regenerated with new mod list
4. Next time players launch, they'll get the updated mods

## Token Security

- ✅ **DO:** Keep your token private and secure
- ✅ **DO:** Store it in a password manager
- ❌ **DON'T:** Share your token with anyone
- ❌ **DON'T:** Commit it to code or files
- ❌ **DON'T:** Post it in Discord/forums

## Regenerating a Token

If your token is compromised or lost:
1. Go to https://github.com/settings/tokens
2. Delete the old token
3. Create a new one following Step 1 above
4. Use the new token in Admin Panel

## Troubleshooting

**"Authentication failed" error:**
- Make sure you copied the complete token
- Check that repository access is granted
- Verify Contents permission is set to "Read and write"

**"Permission denied" error:**
- Check repository permissions in token settings
- Make sure you selected the correct repository

**Changes not appearing:**
- Wait 2-3 minutes after upload/delete
- Check GitHub Actions tab: https://github.com/kiroku67/launcher-template/actions
- Verify the workflow ran successfully

## Support

For issues or questions:
- Check GitHub Actions for build errors
- Review workflow logs for details
- Contact your launcher administrator
