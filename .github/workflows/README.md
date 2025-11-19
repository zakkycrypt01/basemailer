# GitHub Workflows

This directory contains GitHub Actions workflows for the BaseMailer SDK.

## Workflows

### 1. CI (`ci.yml`)
- **Triggers**: Pull requests targeting `main`
- **Purpose**: Runs tests, type checking, and build verification
- **Matrix**: Tests on Node.js 18 and 20
- **Path filtering**: Only runs when SDK files or workflows change

### 2. Publish to NPM (`publish-npm.yml`)
- **Triggers**: 
  - Push to `main` branch (automatic)
  - GitHub releases
  - Manual workflow dispatch
- **Purpose**: Automatically updates version and publishes the SDK package to NPM with `beta` tag

## Setup Instructions

### 1. NPM Token
You need to add an NPM token to your repository secrets:

1. Go to [npmjs.com](https://www.npmjs.com) and generate an access token
2. In your GitHub repository, go to Settings → Secrets and variables → Actions
3. Add a new repository secret named `NPM_TOKEN` with your NPM access token

### 2. Publishing Options

#### Option A: Automatic Publishing (Default)
1. Make changes to the SDK code
2. Push or merge to the `main` branch
3. The workflow will automatically:
   - Run all tests
   - Increment the patch version
   - Create a git tag
   - Build and publish to NPM with `beta` tag
   - Commit the version bump back to the repository

#### Option B: Manual Release
1. Run the "Publish to NPM" workflow manually from the Actions tab
2. Choose the version type (patch/minor/major)
3. The workflow will:
   - Update the version in `package.json`
   - Create a git tag
   - Build and publish to NPM with `beta` tag

#### Option C: GitHub Release
1. Create a new release on GitHub
2. The workflow will automatically publish to NPM with `beta` tag

## Important Notes

- **Automatic Version Bumping**: Every push to `main` that changes SDK files will automatically increment the patch version
- **Skip CI**: To avoid version bumps, include `[skip ci]` in your commit message
- **Pull Request Testing**: CI tests run on pull requests but don't publish

## Installation

Users can install the beta version of your package using:

```bash
npm install @basemailer/sdk@beta
```

## Testing

The workflows include comprehensive testing:
- Type checking with TypeScript
- Unit tests with Vitest
- Build verification
- Package verification (dry-run)

All tests must pass before publishing to NPM.